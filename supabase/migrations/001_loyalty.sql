-- Application actors are Supabase Auth UUIDs; local demo sessions use the same contract.
create extension if not exists pgcrypto;
create table businesses(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, logo text default '', color text not null default '#194d3b', program text not null, goal int not null check(goal between 2 and 30), reward text not null, terms text not null, privacy text not null, status text not null default 'draft' check(status in ('draft','active','suspended')), provider text not null default 'web' check(provider in ('web','pass_studio')), template_id text default '', created_at timestamptz default now());
create table memberships(user_id uuid not null, business_id uuid references businesses, role text not null check(role in ('platform','admin','cashier')), email text not null, unique(user_id,business_id));
create unique index platform_member on memberships(user_id) where business_id is null;
create table customers(id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses, name text not null, email text not null, phone text, marketing boolean not null default false, consent_at timestamptz not null default now(), accepted_terms text not null, privacy_presented text not null, access_token uuid unique not null default gen_random_uuid(), scan_token uuid unique not null default gen_random_uuid(), cycle_goal int not null, cycle_reward text not null, cycle_terms text not null, stamps int not null default 0 check(stamps>=0), version bigint not null default 0, created_at timestamptz not null default now(), unique(business_id,email));
create table rewards(id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses, customer_id uuid not null references customers, description text not null, terms text not null, state text not null default 'available' check(state in ('available','redeemed','reversed')), created_at timestamptz not null default now(), redeemed_at timestamptz);
create table movements(id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses, customer_id uuid not null references customers, employee_id uuid not null, kind text not null check(kind in ('stamp','redeem','reverse')), reward_id uuid references rewards, reverses uuid unique references movements, reason text, idempotency_key uuid not null, sequence bigint not null, snapshot jsonb, created_at timestamptz not null default now(), unique(business_id,idempotency_key));
create table wallet_cards(id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses, customer_id uuid not null references customers, provider text not null, external_pass_id text, external_instance_id text, distribution_url text, status text not null default 'pending', synced_version bigint not null default -1, synced_at timestamptz, attempts int not null default 0, last_error text, unique(customer_id,provider));
create table wallet_jobs(id uuid primary key default gen_random_uuid(), card_id uuid not null references wallet_cards, version bigint not null, kind text not null check(kind in ('issue','update')), status text not null default 'pending', attempts int not null default 0, run_after timestamptz not null default now(), error text, created_at timestamptz default now(), unique(card_id,version,kind));
create table wallet_operations(id uuid primary key default gen_random_uuid(), job_id uuid unique references wallet_jobs, business_id uuid not null references businesses, kind text not null, estimated_units int not null default 1, status text not null, created_at timestamptz default now());
create table demo_sessions(token_hash text primary key,user_id uuid not null,expires_at timestamptz not null);
create function actor_id() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function can_access(b uuid, admin_only boolean default false) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from memberships where user_id=actor_id() and (role='platform' or (business_id=b and (not admin_only or role='admin')))) $$;
create function is_platform() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from memberships where user_id=actor_id() and role='platform') $$;
-- Deny anonymous direct access. Public registration/cards are narrowly scoped RPCs.
do $$declare t text; begin foreach t in array array['businesses','memberships','customers','rewards','movements','wallet_cards','wallet_jobs','wallet_operations','demo_sessions'] loop execute format('alter table %I enable row level security',t); end loop; end$$;
create policy businesses_read on businesses for select using(can_access(id));
create policy membership_read on memberships for select using(user_id=actor_id() or can_access(business_id,true));
create policy customers_read on customers for select using(can_access(business_id));
create policy rewards_read on rewards for select using(can_access(business_id));
create policy movements_read on movements for select using(can_access(business_id));
create policy cards_read on wallet_cards for select using(can_access(business_id,true));
create policy jobs_read on wallet_jobs for select using(exists(select 1 from wallet_cards c where c.id=card_id and can_access(c.business_id,true)));
create policy operations_read on wallet_operations for select using(can_access(business_id,true));
create function public_program(p_slug text) returns jsonb language sql security definer set search_path=public as $$select to_jsonb(b)-'template_id' from businesses b where slug=p_slug and status='active'$$;
create function register_customer(p_slug text,p_name text,p_email text,p_phone text,p_marketing boolean,p_accept boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare b businesses; c customers; begin
select * into b from businesses where slug=p_slug and status='active'; if b.id is null or not p_accept then raise exception 'Programa no disponible o condiciones no aceptadas'; end if;
if length(trim(p_name)) not between 2 and 100 or p_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(p_email)>254 or length(p_phone)>30 then raise exception 'Datos inválidos'; end if;
insert into customers(business_id,name,email,phone,marketing,accepted_terms,privacy_presented,cycle_goal,cycle_reward,cycle_terms) values(b.id,trim(p_name),lower(trim(p_email)),nullif(p_phone,''),p_marketing,b.terms,b.privacy,b.goal,b.reward,b.terms) on conflict(business_id,email) do nothing returning * into c;
-- Never disclose an existing bearer card merely from knowledge of an email.
if c.id is null then return jsonb_build_object('existing',true); end if;
return jsonb_build_object('token',c.access_token); end$$;
create function read_card(p_token uuid) returns jsonb language sql security definer set search_path=public as $$select jsonb_build_object('customer',to_jsonb(c)-'email'-'phone'-'access_token','business',to_jsonb(b)-'template_id','rewards',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from rewards r where customer_id=c.id),'[]'::jsonb),'movements',coalesce((select jsonb_agg(jsonb_build_object('kind',m.kind,'created_at',m.created_at) order by created_at desc) from movements m where customer_id=c.id),'[]'::jsonb),'wallet',coalesce((select jsonb_agg(jsonb_build_object('provider',provider,'status',status,'distribution_url',distribution_url,'synced_at',synced_at)) from wallet_cards where customer_id=c.id),'[]'::jsonb)) from customers c join businesses b on b.id=c.business_id where access_token=p_token$$;
create function staff_data(p_business uuid) returns jsonb language plpgsql security definer set search_path=public as $$ begin
if not can_access(p_business) then raise exception 'Acceso denegado'; end if;
return jsonb_build_object('business',(select to_jsonb(b) from businesses b where id=p_business),'customers',coalesce((select jsonb_agg(to_jsonb(c)-'access_token' order by created_at desc) from customers c where business_id=p_business),'[]'::jsonb),'rewards',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from rewards r where business_id=p_business),'[]'::jsonb),'movements',coalesce((select jsonb_agg(to_jsonb(m)-'snapshot' order by created_at desc) from movements m where business_id=p_business),'[]'::jsonb),'wallet',coalesce((select jsonb_agg(to_jsonb(w)) from wallet_cards w where business_id=p_business),'[]'::jsonb),'employees',case when can_access(p_business,true) then coalesce((select jsonb_agg(to_jsonb(e)) from memberships e where business_id=p_business),'[]'::jsonb) else '[]'::jsonb end,'operations',case when can_access(p_business,true) then coalesce((select jsonb_agg(to_jsonb(o)) from wallet_operations o where business_id=p_business),'[]'::jsonb) else '[]'::jsonb end); end$$;
create function my_businesses() returns jsonb language sql security definer set search_path=public as $$select jsonb_build_object('platform',is_platform(),'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from memberships m where user_id=actor_id()),'[]'::jsonb),'businesses',coalesce((select jsonb_agg(to_jsonb(b) order by created_at) from businesses b where can_access(id)),'[]'::jsonb))$$;
create function enqueue_updates(p_customer uuid) returns void language sql security definer set search_path=public as $$insert into wallet_jobs(card_id,version,kind) select w.id,c.version,'update' from wallet_cards w join customers c on c.id=w.customer_id where c.id=p_customer on conflict do nothing$$;
create function record_operation(p_business uuid,p_scan uuid,p_kind text,p_key uuid,p_reward uuid default null,p_reverse uuid default null,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare c customers; b businesses; r rewards; m movements; old movements; issued uuid; result uuid; begin
if not can_access(p_business) then raise exception 'Acceso denegado'; end if;
select * into b from businesses where id=p_business for share;
if b.status<>'active' then raise exception 'Programa inactivo'; end if;
select * into c from customers where business_id=p_business and scan_token=p_scan for update;
if c.id is null then raise exception 'QR inválido para este negocio'; end if;
select * into m from movements where business_id=p_business and idempotency_key=p_key;
if m.id is not null then
 if m.customer_id<>c.id or m.kind<>p_kind or (m.reward_id is distinct from p_reward and p_kind='redeem') or (m.reverses is distinct from p_reverse and p_kind='reverse') then raise exception 'Clave reutilizada para otra operación'; end if;
 return jsonb_build_object('id',m.id,'replayed',true); end if;
if p_kind='stamp' then
 if c.stamps+1>=c.cycle_goal then
 insert into rewards(business_id,customer_id,description,terms) values(b.id,c.id,c.cycle_reward,c.cycle_terms) returning id into issued;
 update customers set stamps=0,cycle_goal=b.goal,cycle_reward=b.reward,cycle_terms=b.terms,version=version+1 where id=c.id;
 else update customers set stamps=stamps+1,version=version+1 where id=c.id; end if;
elsif p_kind='redeem' then
 select * into r from rewards where id=p_reward and customer_id=c.id and business_id=b.id for update;
 if r.id is null or r.state<>'available' then raise exception 'Recompensa no disponible'; end if;
 update rewards set state='redeemed',redeemed_at=now() where id=r.id;
 update customers set version=version+1 where id=c.id;
elsif p_kind='reverse' then
 if not can_access(b.id,true) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Requiere administrador y motivo'; end if;
 select * into old from movements where id=p_reverse and customer_id=c.id and business_id=b.id;
 if old.id is null or old.kind='reverse' or exists(select 1 from movements where reverses=old.id) then raise exception 'Movimiento no reversible'; end if;
 -- Only reverse the latest effective operation; preserves cycle/reward dependencies.
 if exists(select 1 from movements where customer_id=c.id and sequence>old.sequence and kind<>'reverse' and id not in(select reverses from movements where reverses is not null)) then raise exception 'Revierte primero los movimientos posteriores'; end if;
 if old.kind='stamp' then
 if old.reward_id is not null then
 if exists(select 1 from rewards where id=old.reward_id and state='redeemed') then raise exception 'Revierte primero el canje'; end if;
 update rewards set state='reversed' where id=old.reward_id;
 end if;
 update customers set stamps=(old.snapshot->>'stamps')::int,cycle_goal=(old.snapshot->>'cycle_goal')::int,cycle_reward=old.snapshot->>'cycle_reward',cycle_terms=old.snapshot->>'cycle_terms',version=version+1 where id=c.id;
 else update rewards set state='available',redeemed_at=null where id=old.reward_id; update customers set version=version+1 where id=c.id; end if;
else raise exception 'Operación inválida'; end if;
insert into movements(business_id,customer_id,employee_id,kind,reward_id,reverses,reason,idempotency_key,sequence,snapshot) values(b.id,c.id,actor_id(),p_kind,coalesce(issued,p_reward),p_reverse,p_reason,p_key,c.version+1,to_jsonb(c)) returning id into result;
perform enqueue_updates(c.id);
return jsonb_build_object('id',result,'reward',issued,'replayed',false); end$$;
create function save_business(p_data jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$declare result uuid; begin
if (p_id is null and not is_platform()) or (p_id is not null and not can_access(p_id,true)) then raise exception 'Acceso denegado'; end if;
if p_id is null then
 insert into businesses(name,slug,program,goal,reward,terms,privacy,status,logo,color,provider,template_id) values(p_data->>'name',p_data->>'slug',p_data->>'program',(p_data->>'goal')::int,p_data->>'reward',p_data->>'terms',p_data->>'privacy',p_data->>'status',coalesce(p_data->>'logo',''),coalesce(p_data->>'color','#194d3b'),coalesce(p_data->>'provider','web'),coalesce(p_data->>'template_id','')) returning id into result;
else
 if not is_platform() and exists(select 1 from businesses where id=p_id and (provider is distinct from p_data->>'provider' or template_id is distinct from p_data->>'template_id' or status='suspended' and p_data->>'status'<>'suspended')) then raise exception 'Configuración reservada a plataforma'; end if;
 update businesses set name=p_data->>'name',logo=p_data->>'logo',color=p_data->>'color',program=p_data->>'program',goal=(p_data->>'goal')::int,reward=p_data->>'reward',terms=p_data->>'terms',privacy=p_data->>'privacy',status=p_data->>'status',provider=coalesce(p_data->>'provider','web'),template_id=coalesce(p_data->>'template_id','') where id=p_id; result=p_id;
end if; return result; end$$;
create function add_employee(p_business uuid,p_user uuid,p_email text,p_role text) returns void language plpgsql security definer set search_path=public as $$begin
if not can_access(p_business,true) or p_role not in ('admin','cashier') then raise exception 'Acceso denegado'; end if;
insert into memberships(user_id,business_id,email,role) values(p_user,p_business,lower(p_email),p_role) on conflict(user_id,business_id) do update set role=excluded.role; end$$;
create function request_wallet(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare c customers; b businesses; w wallet_cards; begin
select * into c from customers where access_token=p_token for update; if c.id is null then raise exception 'Tarjeta inválida'; end if;
select * into b from businesses where id=c.business_id; if b.status<>'active' then raise exception 'Programa inactivo'; end if;
if b.provider='web' then return jsonb_build_object('web',true); end if;
if coalesce(b.template_id,'')='' then raise exception 'Wallet aún no está configurado'; end if;
insert into wallet_cards(business_id,customer_id,provider) values(b.id,c.id,b.provider) on conflict(customer_id,provider) do nothing;
select * into w from wallet_cards where customer_id=c.id and provider=b.provider;
insert into wallet_jobs(card_id,version,kind) values(w.id,c.version,case when w.external_instance_id is null then 'issue' else 'update' end) on conflict do nothing;
return jsonb_build_object('status',w.status,'url',w.distribution_url); end$$;
-- Grant only the intended RPC surface. No direct client writes, including to the queue.
revoke execute on all functions in schema public from public;
do $$begin if exists(select 1 from pg_roles where rolname='anon') then
 grant usage on schema public to anon,authenticated;
 grant execute on function public_program(text),register_customer(text,text,text,text,boolean,boolean),read_card(uuid),request_wallet(uuid) to anon,authenticated;
 grant execute on function my_businesses(),staff_data(uuid),record_operation(uuid,uuid,text,uuid,uuid,uuid,text),save_business(jsonb,uuid),add_employee(uuid,uuid,text,text),actor_id(),can_access(uuid,boolean),is_platform() to authenticated;
 grant select on businesses,memberships,customers,rewards,movements,wallet_cards,wallet_jobs,wallet_operations to authenticated;
 end if; end$$;

do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on all functions in schema public to service_role; end if; end$$;
