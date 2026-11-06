"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logout as endSession, requireStaff } from "@/lib/auth";
import * as ops from "@/lib/ops";
import type { VisitResult } from "@/lib/ops";

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Registra una visita. El negocio sale de la membresía, nunca del cliente. */
export async function registerVisit(code: string): Promise<VisitResult> {
  const s = await requireStaff(["admin", "staff"]);
  const clean = String(code).trim().toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(clean)) return { ok: false, error: "codigo_invalido" };
  const r = ops.registerVisit(s.business!.id, clean, s.userId);
  revalidatePath("/panel/clientes");
  return r;
}

export async function redeemReward(rewardId: string) {
  const s = await requireStaff(["admin", "staff"]);
  const r = ops.redeemReward(s.business!.id, String(rewardId), s.userId);
  revalidatePath("/panel/clientes");
  return r;
}

export async function voidVisit(visitId: string, reason: string) {
  const s = await requireStaff(["admin"]);
  const r = ops.voidVisit(s.business!.id, String(visitId), s.userId, String(reason));
  revalidatePath("/panel/clientes");
  return r;
}
