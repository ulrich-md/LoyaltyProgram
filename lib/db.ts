import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { hashPassword } from "./password";

const SCHEMA = `
create table if not exists businesses (
  id text primary key, slug text not null unique, name text not null, tagline text not null default '',
  brand_primary text not null default '#b8416b', brand_soft text not null default '#fbe3ea',
  goal integer not null default 6 check (goal between 2 and 20),
  reward text not null default 'Beneficio por definir', eligible_service text not null default 'Servicio elegible',
  max_visits_per_day integer not null default 1 check (max_visits_per_day between 1 and 10),
  timezone text not null default 'America/Costa_Rica', active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
create table if not exists users (
  id text primary key, email text not null unique, password_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
create table if not exists memberships (
  user_id text not null references users(id) on delete cascade,
  business_id text references businesses(id) on delete cascade,
  role text not null check (role in ('platform','admin','staff')),
  check ((role = 'platform') = (business_id is null)));
create unique index if not exists memberships_user_idx on memberships(user_id);
create table if not exists sessions (
  token_hash text primary key, user_id text not null references users(id) on delete cascade, expires_at text not null);
create table if not exists login_attempts (email text not null, at integer not null);
create index if not exists login_attempts_idx on login_attempts(email, at);
create table if not exists customers (
  id text primary key, business_id text not null references businesses(id) on delete cascade,
  name text not null, email text not null, phone text,
  card_token text not null unique, qr_code text not null unique,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
create unique index if not exists customers_email_uniq on customers(business_id, lower(email));
create table if not exists rewards (
  id text primary key, business_id text not null references businesses(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade, description text not null,
  earned_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')), redeemed_at text, redeemed_by text);
create table if not exists visits (
  id text primary key, business_id text not null references businesses(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade, staff_id text,
  reward_id text references rewards(id), local_day text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  voided_at text, voided_by text, void_reason text);
create index if not exists visits_customer_idx on visits(customer_id, created_at);
`;

const g = globalThis as unknown as { __db?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__db) return g.__db;
  const file = process.env.DATA_FILE ?? "./data/app.db";
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("pragma journal_mode = WAL; pragma foreign_keys = on; pragma busy_timeout = 5000;");
  d.exec(SCHEMA);
  seed(d);
  g.__db = d;
  return d;
}

/** Datos iniciales: I Bloom de ejemplo y el usuario de plataforma desde el entorno. */
function seed(d: DatabaseSync) {
  if (!d.prepare("select 1 from businesses limit 1").get()) {
    d.prepare("insert into businesses(id,slug,name,tagline,goal,reward,eligible_service) values (?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), "ibloom", "I Bloom Spa", "Tu bienestar tiene recompensa.", 6, "Facial de cortesía", "Faciales y masajes");
  }
  const email = process.env.BOOTSTRAP_EMAIL?.toLowerCase();
  const pass = process.env.BOOTSTRAP_PASSWORD;
  if (email && pass && !d.prepare("select 1 from memberships where role='platform' limit 1").get()) {
    const id = crypto.randomUUID();
    d.prepare("insert into users(id,email,password_hash) values (?,?,?)").run(id, email, hashPassword(pass));
    d.prepare("insert into memberships(user_id,business_id,role) values (?,null,'platform')").run(id);
  }
}

/** Ejecuta fn dentro de una transacción inmediata (escritor exclusivo). */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("begin immediate");
  try { const r = fn(); d.exec("commit"); return r; } catch (e) { d.exec("rollback"); throw e; }
}

export const q = {
  all: <T = Record<string, unknown>>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).all(...p) as T[],
  get: <T = Record<string, unknown>>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).get(...p) as T | undefined,
  run: (sql: string, ...p: (string | number | null)[]) => db().prepare(sql).run(...p),
};
