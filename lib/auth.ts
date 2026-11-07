import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, sha, type Business, type Role } from "./db";
import { getBusiness } from "./store";
import { verifyPassword } from "./password";

export type { Business };
export type Staff = { userId: string; email: string; role: Role; business: Business | null };

const COOKIE = "sid";
const TTL_MS = 8 * 3600_000;

/** Devuelve true si el login es correcto y abre sesión. Limita 5 intentos fallidos por correo cada 15 min. */
export async function login(email: string, password: string): Promise<boolean> {
  email = email.trim().toLowerCase();
  const d = await db();
  const attemptsRef = d.doc(`loginAttempts/${sha(email)}`);
  const recent = ((await attemptsRef.get()).data()?.times as number[] | undefined)?.filter((x) => x > Date.now() - 15 * 60_000) ?? [];
  if (recent.length >= 5) return false;
  const u = (await d.doc(`users/${sha(email)}`).get()).data();
  // verifyPassword se ejecuta siempre para no revelar si el correo existe por tiempo de respuesta.
  const ok = verifyPassword(password, u?.password_hash ?? "scrypt$00$00") && !!u;
  if (!ok) { await attemptsRef.set({ times: [...recent, Date.now()] }); return false; }
  await attemptsRef.delete();
  const token = randomBytes(32).toString("hex");
  await d.doc(`sessions/${sha(token)}`).set({ user_id: sha(email), expires_at: Date.now() + TTL_MS });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await (await db()).doc(`sessions/${sha(t)}`).delete();
  jar.delete(COOKIE);
}

export async function getStaff(): Promise<Staff | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const d = await db();
  const sref = d.doc(`sessions/${sha(t)}`), s = (await sref.get()).data();
  if (!s) return null;
  if (s.expires_at < Date.now()) { await sref.delete(); return null; }
  const u = (await d.doc(`users/${s.user_id}`).get()).data();
  if (!u) return null;
  const business = u.business_id ? await getBusiness(u.business_id) : null;
  return { userId: s.user_id, email: u.email, role: u.role, business };
}

export async function requireStaff(roles: Role[] = ["platform", "admin", "staff"]) {
  const s = await getStaff();
  if (!s) redirect("/login");
  if (!roles.includes(s.role)) redirect("/panel");
  return s;
}
