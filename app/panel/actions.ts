"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { admin, sessionClient } from "@/lib/supabase";

export async function logout() {
  const sb = await sessionClient();
  await sb.auth.signOut();
  redirect("/login");
}

/** Registra una visita. El negocio sale de la membresía, nunca del cliente. */
export type VisitResult = { ok: boolean; error?: string; customer?: string; progress?: number; goal?: number; reward_ready?: boolean };

export async function registerVisit(code: string): Promise<VisitResult> {
  const s = await requireStaff(["admin", "staff"]);
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(clean)) return { ok: false, error: "codigo_invalido" };
  const { data, error } = await admin().rpc("register_visit", { p_business: s.business!.id, p_qr: clean, p_staff: s.userId });
  if (error) return { ok: false, error: "error_servidor" };
  revalidatePath("/panel/clientes");
  return data as VisitResult;
}

export async function redeemReward(rewardId: string) {
  const s = await requireStaff(["admin", "staff"]);
  const { data } = await admin().rpc("redeem_reward", { p_business: s.business!.id, p_reward: rewardId, p_staff: s.userId });
  revalidatePath("/panel/clientes");
  return data as { ok: boolean; error?: string };
}

export async function voidVisit(visitId: string, reason: string) {
  const s = await requireStaff(["admin"]);
  const { data } = await admin().rpc("void_visit", { p_business: s.business!.id, p_visit: visitId, p_staff: s.userId, p_reason: reason.slice(0, 200) || "sin motivo" });
  revalidatePath("/panel/clientes");
  return data as { ok: boolean; error?: string };
}
