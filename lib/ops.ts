import "server-only";
import { randomBytes } from "node:crypto";
import { q, tx, type Q } from "./db";
import type { Business } from "./auth";

export type VisitResult = { ok: boolean; error?: string; customer?: string; progress?: number; goal?: number; reward_ready?: boolean };

const dayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
const pending = async (t: Q, customerId: string) =>
  (await t.get<{ n: number }>("select count(*)::int n from visits where customer_id=$1 and voided_at is null and reward_id is null", customerId))!.n;

export function registerVisit(businessId: string, qr: string, staffId: string): Promise<VisitResult> {
  return tx(async (t) => {
    const b = await t.get<Business>("select * from businesses where id=$1 and active", businessId);
    if (!b) return { ok: false, error: "negocio_inactivo" };
    // for update serializa visitas simultáneas de la misma clienta
    const c = await t.get<{ id: string; name: string }>("select id, name from customers where business_id=$1 and qr_code=$2 for update", businessId, qr.toUpperCase());
    if (!c) return { ok: false, error: "clienta_no_encontrada" };
    const day = dayIn(b.timezone);
    const today = (await t.get<{ n: number }>("select count(*)::int n from visits where customer_id=$1 and voided_at is null and local_day=$2", c.id, day))!.n;
    if (today >= b.max_visits_per_day) return { ok: false, error: "limite_diario", customer: c.name };
    await t.run("insert into visits(business_id,customer_id,staff_id,local_day) values ($1,$2,$3,$4)", businessId, c.id, staffId, day);
    let progress = await pending(t, c.id), ready = false;
    if (progress >= b.goal) {
      const r = (await t.get<{ id: string }>("insert into rewards(business_id,customer_id,description) values ($1,$2,$3) returning id", businessId, c.id, b.reward))!;
      await t.run("update visits set reward_id=$1 where customer_id=$2 and voided_at is null and reward_id is null", r.id, c.id);
      ready = true; progress = 0;
    }
    return { ok: true, customer: c.name, progress, goal: b.goal, reward_ready: ready };
  });
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export function redeemReward(businessId: string, rewardId: string, staffId: string) {
  return tx(async (t) => {
    if (!isUuid(rewardId)) return { ok: false, error: "no_encontrado" };
    const r = await t.get<{ redeemed_at: string | null }>("select redeemed_at from rewards where id=$1 and business_id=$2 for update", rewardId, businessId);
    if (!r) return { ok: false, error: "no_encontrado" };
    if (r.redeemed_at) return { ok: false, error: "ya_canjeado" };
    await t.run("update rewards set redeemed_at=now(), redeemed_by=$1 where id=$2", staffId, rewardId);
    return { ok: true };
  });
}

export function voidVisit(businessId: string, visitId: string, staffId: string, reason: string) {
  return tx(async (t) => {
    if (!isUuid(visitId)) return { ok: false, error: "no_encontrada" };
    const v = await t.get<{ voided_at: string | null; reward_id: string | null }>("select voided_at, reward_id from visits where id=$1 and business_id=$2 for update", visitId, businessId);
    if (!v) return { ok: false, error: "no_encontrada" };
    if (v.voided_at) return { ok: false, error: "ya_anulada" };
    if (v.reward_id) return { ok: false, error: "ya_en_beneficio" };
    await t.run("update visits set voided_at=now(), voided_by=$1, void_reason=$2 where id=$3", staffId, reason.slice(0, 200) || "sin motivo", visitId);
    return { ok: true };
  });
}

export const newCodes = () => ({
  card_token: randomBytes(24).toString("hex"),
  qr_code: randomBytes(8).toString("hex").toUpperCase(),
});
export { q };
