create table rate_buckets(bucket text not null,window_start timestamptz not null,requests int not null,primary key(bucket,window_start));
alter table rate_buckets enable row level security;
create function consume_rate(p_bucket text,p_limit int,p_window int) returns boolean language plpgsql security definer set search_path=public as $$declare n int; w timestamptz; begin
w=to_timestamp(floor(extract(epoch from now())/p_window)*p_window);
insert into rate_buckets(bucket,window_start,requests) values(p_bucket,w,1) on conflict(bucket,window_start) do update set requests=rate_buckets.requests+1 returning requests into n;
return n<=p_limit; end$$;
create function platform_metrics() returns jsonb language plpgsql security definer set search_path=public as $$begin if not is_platform() then raise exception 'Acceso denegado'; end if;return jsonb_build_object('businesses',(select count(*) from businesses),'active',(select count(*) from businesses where status='active'),'customers',(select count(*) from customers),'stamps',(select count(*) from movements where kind='stamp'));end$$;
revoke execute on function consume_rate(text,int,int),platform_metrics() from public;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function consume_rate(text,int,int) to service_role; end if;
if exists(select 1 from pg_roles where rolname='authenticated') then grant execute on function platform_metrics() to authenticated; end if;end$$;
create index movements_business_date on movements(business_id,created_at desc);
create index movements_customer_sequence on movements(customer_id,sequence desc);
create index rewards_customer_state on rewards(customer_id,state);
create index jobs_ready on wallet_jobs(run_after,created_at) where status='pending';
create index memberships_user on memberships(user_id);
