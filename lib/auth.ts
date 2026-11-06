import { redirect } from "next/navigation";
import { admin, sessionClient } from "./supabase";

export type Business = {
  id: string; slug: string; name: string; tagline: string; brand_primary: string; brand_soft: string;
  logo_url: string | null; goal: number; reward: string; eligible_service: string;
  max_visits_per_day: number; timezone: string; active: boolean;
};
export type Staff = { userId: string; email: string; role: "platform" | "admin" | "staff"; business: Business | null };

/** Devuelve el usuario autenticado y su rol, validando contra la base de datos. */
export async function getStaff(): Promise<Staff | null> {
  const sb = await sessionClient();
  const { data } = await sb.auth.getUser(); // valida el JWT con Supabase Auth
  if (!data.user) return null;
  const db = admin();
  const { data: ms } = await db.from("memberships").select("role, business_id, email").eq("user_id", data.user.id);
  const m = ms?.find((x) => x.role === "platform") ?? ms?.[0];
  if (!m) return null;
  let business: Business | null = null;
  if (m.business_id) {
    const { data: b } = await db.from("businesses").select("*").eq("id", m.business_id).single();
    business = b as Business | null;
  }
  return { userId: data.user.id, email: m.email, role: m.role, business };
}

export async function requireStaff(roles: Staff["role"][] = ["platform", "admin", "staff"]) {
  const s = await getStaff();
  if (!s) redirect("/login");
  if (!roles.includes(s.role)) redirect("/panel");
  return s;
}
