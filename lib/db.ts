import "server-only";
import { Pool, type PoolClient } from "pg";
import { hashPassword } from "./password";

const SCHEMA = `
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null, tagline text not null default '',
  brand_primary text not null default '#b8416b' check (brand_primary ~ '^#[0-9a-fA-F]{6}$'),
  brand_soft text not null default '#fbe3ea' check (brand_soft ~ '^#[0-9a-fA-F]{6}$'),
  goal int not null default 6 check (goal between 2 and 20),
  reward text not null default 'Beneficio por definir', eligible_service text not null default 'Servicio elegible',
  max_visits_per_day int not null default 1 check (max_visits_per_day between 1 and 10),
  timezone text not null default 'America/Costa_Rica', active boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists users (
  id uuid primary key default gen_random_uuid(), email text not null unique, password_hash text not null,
  created_at timestamptz not null default now());
create table if not exists memberships (
  user_id uuid not null references users(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  role text not null check (role in ('platform','admin','staff')),
  check ((role = 'platform') = (business_id is null)));
create unique index if not exists memberships_user_idx on memberships(user_id);
create table if not exists sessions (
  token_hash text primary key, user_id uuid not null references users(id) on delete cascade, expires_at timestamptz not null);
create table if not exists login_attempts (email text not null, at bigint not null);
create index if not exists login_attempts_idx on login_attempts(email, at);
create table if not exists customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  name text not null, email text not null, phone text,
  card_token text not null unique, qr_code text not null unique, created_at timestamptz not null default now());
create unique index if not exists customers_email_uniq on customers(business_id, lower(email));
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade, description text not null,
  earned_at timestamptz not null default now(), redeemed_at timestamptz, redeemed_by uuid);
create table if not exists visits (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade, staff_id uuid,
  reward_id uuid references rewards(id), local_day date not null, created_at timestamptz not null default now(),
  voided_at timestamptz, voided_by uuid, void_reason text);
create index if not exists visits_customer_idx on visits(customer_id, created_at);
alter table businesses enable row level security; alter table users enable row level security;
alter table memberships enable row level security; alter table sessions enable row level security;
alter table customers enable row level security; alter table rewards enable row level security;
alter table visits enable row level security; alter table login_attempts enable row level security;
`;

type Param = string | number | boolean | null;
export type Q = {
  all<T = Record<string, unknown>>(sql: string, ...p: Param[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, ...p: Param[]): Promise<T | undefined>;
  run(sql: string, ...p: Param[]): Promise<number>;
};

const g = globalThis as unknown as { __pool?: Pool; __ready?: Promise<void> };

function pool(): Pool {
  if (!g.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL (cadena de conexión de Neon/Postgres)");
    g.__pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  }
  return g.__pool;
}

const make = (exec: (sql: string, p: Param[]) => Promise<{ rows: unknown[]; rowCount: number | null }>): Q => ({
  all: async (sql, ...p) => (await exec(sql, p)).rows as never,
  get: async (sql, ...p) => (await exec(sql, p)).rows[0] as never,
  run: async (sql, ...p) => (await exec(sql, p)).rowCount ?? 0,
});

/** Crea el esquema y los datos iniciales una sola vez por instancia. */
function ready(): Promise<void> {
  g.__ready ??= (async () => {
    const c = await pool().connect();
    try {
      await c.query("select pg_advisory_lock(727001)");
      await c.query(SCHEMA);
      if ((await c.query("select 1 from businesses limit 1")).rowCount === 0)
        await c.query("insert into businesses(slug,name,tagline,goal,reward,eligible_service) values ('ibloom','I Bloom Spa','Tu bienestar tiene recompensa.',6,'Facial de cortesía','Faciales y masajes')");
      const email = process.env.BOOTSTRAP_EMAIL?.toLowerCase(), pass = process.env.BOOTSTRAP_PASSWORD;
      if (email && pass && (await c.query("select 1 from memberships where role='platform'")).rowCount === 0) {
        const u = await c.query("insert into users(email,password_hash) values ($1,$2) on conflict (email) do update set password_hash=excluded.password_hash returning id", [email, hashPassword(pass)]);
        await c.query("insert into memberships(user_id,business_id,role) values ($1,null,'platform')", [u.rows[0].id]);
      }
      await c.query("select pg_advisory_unlock(727001)");
    } finally { c.release(); }
  })().catch((e) => { g.__ready = undefined; throw e; });
  return g.__ready;
}

export const q: Q = make(async (sql, p) => { await ready(); return pool().query(sql, p); });

/** Transacción: fn recibe un Q ligado a una sola conexión. */
export async function tx<T>(fn: (t: Q) => Promise<T>): Promise<T> {
  await ready();
  const c: PoolClient = await pool().connect();
  try {
    await c.query("begin");
    const r = await fn(make((sql, p) => c.query(sql, p)));
    await c.query("commit");
    return r;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}
