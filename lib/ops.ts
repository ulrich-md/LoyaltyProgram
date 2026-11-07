import "server-only";
import { db, type Business, type Customer } from "./db";

export type VisitResult = { ok: boolean; error?: string; customer?: string; progress?: number; goal?: number; reward_ready?: boolean };

const dayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
const idOk = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const now = () => new Date().toISOString();

/** Suma una visita. Toda la operación es una transacción: dos escaneos simultáneos no pueden saltarse el límite. */
export async function registerVisit(businessId: string, qr: string, staffId: string): Promise<VisitResult> {
  const d = await db();
  return d.runTransaction(async (t) => {
    const bs = await t.get(d.doc(`businesses/${businessId}`));
    const b = bs.exists ? (bs.data() as Business) : null;
    if (!b || !b.active) return { ok: false, error: "negocio_inactivo" };
    const cs = await t.get(d.collection("customers").where("business_id", "==", businessId).where("qr_code", "==", qr.toUpperCase()).limit(1));
    if (cs.empty) return { ok: false, error: "clienta_no_encontrada" };
    const cref = cs.docs[0].ref, c = cs.docs[0].data() as Customer;
    const day = dayIn(b.timezone);
    const dayCount = c.day === day ? c.day_count : 0;
    if (dayCount >= b.max_visits_per_day) return { ok: false, error: "limite_diario", customer: c.name };

    let progress = c.progress + 1;
    const ready = progress >= b.goal;
    // Todas las lecturas antes de escribir
    const cycle = ready ? await t.get(d.collection("visits").where("customer_id", "==", cref.id).where("reward_id", "==", null).where("voided_at", "==", null)) : null;

    const vref = d.collection("visits").doc();
    t.create(vref, { business_id: businessId, customer_id: cref.id, staff_id: staffId, local_day: day, created_at: now(), reward_id: null, voided_at: null, voided_by: null, void_reason: null });
    if (ready) {
      const rref = d.collection("rewards").doc();
      t.create(rref, { business_id: businessId, customer_id: cref.id, description: b.reward, earned_at: now(), redeemed_at: null, redeemed_by: null });
      cycle!.docs.forEach((v) => t.update(v.ref, { reward_id: rref.id }));
      t.update(vref, { reward_id: rref.id });
      progress = 0;
    }
    t.update(cref, { progress, day, day_count: dayCount + 1 });
    return { ok: true, customer: c.name, progress, goal: b.goal, reward_ready: ready };
  });
}

export async function redeemReward(businessId: string, rewardId: string, staffId: string) {
  if (!idOk(rewardId)) return { ok: false, error: "no_encontrado" };
  const d = await db();
  return d.runTransaction(async (t) => {
    const ref = d.doc(`rewards/${rewardId}`), s = await t.get(ref);
    if (!s.exists || s.data()!.business_id !== businessId) return { ok: false, error: "no_encontrado" };
    if (s.data()!.redeemed_at) return { ok: false, error: "ya_canjeado" };
    t.update(ref, { redeemed_at: now(), redeemed_by: staffId });
    return { ok: true };
  });
}

/** Anula una visita que aún no se usó en un beneficio y corrige los contadores de la clienta. */
export async function voidVisit(businessId: string, visitId: string, staffId: string, reason: string) {
  if (!idOk(visitId)) return { ok: false, error: "no_encontrada" };
  const d = await db();
  return d.runTransaction(async (t) => {
    const vref = d.doc(`visits/${visitId}`), vs = await t.get(vref);
    if (!vs.exists || vs.data()!.business_id !== businessId) return { ok: false, error: "no_encontrada" };
    const v = vs.data()!;
    if (v.voided_at) return { ok: false, error: "ya_anulada" };
    if (v.reward_id) return { ok: false, error: "ya_en_beneficio" };
    const cref = d.doc(`customers/${v.customer_id}`), c = (await t.get(cref)).data() as Customer;
    t.update(vref, { voided_at: now(), voided_by: staffId, void_reason: reason.slice(0, 200) || "sin motivo" });
    t.update(cref, { progress: Math.max(0, c.progress - 1), ...(c.day === v.local_day ? { day_count: Math.max(0, c.day_count - 1) } : {}) });
    return { ok: true };
  });
}
