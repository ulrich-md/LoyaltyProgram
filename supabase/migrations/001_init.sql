-- Plataforma de lealtad multi-negocio. Todo el acceso ocurre desde el servidor
-- con la service role; RLS queda activo sin políticas para bloquear acceso directo.
create extension if not exists pgcrypto;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  tagline text not null default '',
  brand_primary text not null default '#b8416b' check (brand_primary ~ '^#[0-9a-fA-F]{6}$'),
  brand_soft text not null default '#fbe3ea' check (brand_soft ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  goal int not null default 6 check (goal between 2 and 20),
  reward text not null default 'Beneficio por definir',
  eligible_service text not null default 'Servicio elegible',
  max_visits_per_day int not null default 1 check (max_visits_per_day between 1 and 10),
  timezone text not null default 'America/Costa_Rica',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table memberships (
  user_id uuid not null,
  business_id uuid references businesses(id) on delete cascade,
  role text not null check (role in ('platform','admin','staff')),
  email text not null,
  created_at timestamptz not null default now(),
  check ((role = 'platform') = (business_id is null)),
  unique (user_id, business_id)
);
create unique index memberships_platform_uniq on memberships(user_id) where business_id is null;

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (length(name) between 2 and 100),
  email text not null,
  phone text,
  card_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  qr_code text not null unique default upper(encode(gen_random_bytes(8), 'hex')),
  serial int generated always as identity,
  created_at timestamptz not null default now()
);
create unique index customers_email_uniq on customers(business_id, lower(email));

create table rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  description text not null,
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  staff_id uuid,
  note text,
  reward_id uuid references rewards(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index visits_customer_idx on visits(customer_id, created_at desc);

alter table businesses enable row level security;
alter table memberships enable row level security;
alter table customers enable row level security;
alter table rewards enable row level security;
alter table visits enable row level security;

-- Registra una visita de forma atómica. Devuelve json con estado.
create or replace function register_visit(p_business uuid, p_qr text, p_staff uuid, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  b businesses; c customers; today_count int; progress int; new_reward rewards; reward_ready boolean := false;
begin
  select * into b from businesses where id = p_business and active;
  if not found then return json_build_object('ok', false, 'error', 'negocio_inactivo'); end if;
  select * into c from customers where business_id = p_business and qr_code = upper(p_qr) for update;
  if not found then return json_build_object('ok', false, 'error', 'clienta_no_encontrada'); end if;

  select count(*) into today_count from visits
   where customer_id = c.id and voided_at is null
     and (created_at at time zone b.timezone)::date = (now() at time zone b.timezone)::date;
  if today_count >= b.max_visits_per_day then
    return json_build_object('ok', false, 'error', 'limite_diario', 'customer', c.name);
  end if;

  insert into visits(business_id, customer_id, staff_id, note) values (p_business, c.id, p_staff, p_note);
  select count(*) into progress from visits where customer_id = c.id and voided_at is null and reward_id is null;
  if progress >= b.goal then
    insert into rewards(business_id, customer_id, description) values (p_business, c.id, b.reward) returning * into new_reward;
    update visits set reward_id = new_reward.id where customer_id = c.id and voided_at is null and reward_id is null;
    reward_ready := true; progress := 0;
  end if;
  return json_build_object('ok', true, 'customer', c.name, 'progress', progress, 'goal', b.goal, 'reward_ready', reward_ready);
end $$;

-- Anula una visita aún no usada en un beneficio.
create or replace function void_visit(p_business uuid, p_visit uuid, p_staff uuid, p_reason text)
returns json language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  select * into v from visits where id = p_visit and business_id = p_business for update;
  if not found then return json_build_object('ok', false, 'error', 'no_encontrada'); end if;
  if v.voided_at is not null then return json_build_object('ok', false, 'error', 'ya_anulada'); end if;
  if v.reward_id is not null then return json_build_object('ok', false, 'error', 'ya_en_beneficio'); end if;
  update visits set voided_at = now(), voided_by = p_staff, void_reason = p_reason where id = p_visit;
  return json_build_object('ok', true);
end $$;

create or replace function redeem_reward(p_business uuid, p_reward uuid, p_staff uuid)
returns json language plpgsql security definer set search_path = public as $$
declare r rewards;
begin
  select * into r from rewards where id = p_reward and business_id = p_business for update;
  if not found then return json_build_object('ok', false, 'error', 'no_encontrado'); end if;
  if r.redeemed_at is not null then return json_build_object('ok', false, 'error', 'ya_canjeado'); end if;
  update rewards set redeemed_at = now(), redeemed_by = p_staff where id = p_reward;
  return json_build_object('ok', true);
end $$;

revoke all on function register_visit, void_visit, redeem_reward from public, anon, authenticated;
