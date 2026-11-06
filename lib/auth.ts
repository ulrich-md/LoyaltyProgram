import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q } from "./db";
import { verifyPassword } from "./password";

export type Business = {
  id: string; slug: string; name: string; tagline: string; brand_primary: string; brand_soft: string;
  goal: number; reward: string; eligible_service: string; max_visits_per_day: number; timezone: string; active: boolean;
};
export type Staff = { userId: string; email: string; role: "platform" | "admin" | "staff"; business: Business | null };

const COOKIE = "sid";
const TTL_MS = 8 * 3600_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Devuelve true si el login es correcto y abre sesión. Limita 5 intentos por correo cada 15 min. */
export async function login(email: string, password: string): Promise<boolean> {
  email = email.trim().toLowerCase();
  const since = Date.now() - 15 * 60_000;
  await q.run("delete from login_attempts where at < $1", since);
  if (((await q.get<{ n: number }>("select count(*)::int n from login_attempts where email=$1", email))?.n ?? 0) >= 5) return false;
  const u = await q.get<{ id: string; password_hash: string }>("select id, password_hash from users where email=$1", email);
  // verifyPassword se ejecuta siempre para no revelar si el correo existe por tiempo de respuesta.
  const ok = verifyPassword(password, u?.password_hash ?? "scrypt$00$00") && !!u;
  if (!ok) { await q.run("insert into login_attempts(email, at) values ($1,$2)", email, Date.now()); return false; }
  await q.run("delete from login_attempts where email=$1", email);
  const token = randomBytes(32).toString("hex");
  await q.run("insert into sessions(token_hash,user_id,expires_at) values ($1,$2,$3)", sha(token), u!.id, new Date(Date.now() + TTL_MS).toISOString());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await q.run("delete from sessions where token_hash=$1", sha(t));
  jar.delete(COOKIE);
}

export async function getStaff(): Promise<Staff | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const row = await q.get<{ user_id: string; email: string; role: Staff["role"]; business_id: string | null }>(
    `select s.user_id, u.email, m.role, m.business_id from sessions s
     join users u on u.id=s.user_id join memberships m on m.user_id=u.id where s.token_hash=$1 and s.expires_at > now()`, sha(t));
  if (!row) return null;
  const business = row.business_id ? (await q.get<Business>("select * from businesses where id=$1", row.business_id)) ?? null : null;
  return { userId: row.user_id, email: row.email, role: row.role, business };
}

export async function requireStaff(roles: Staff["role"][] = ["platform", "admin", "staff"]) {
  const s = await getStaff();
  if (!s) redirect("/login");
  if (!roles.includes(s.role)) redirect("/panel");
  return s;
}
