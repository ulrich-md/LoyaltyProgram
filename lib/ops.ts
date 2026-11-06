import "server-only";
import { randomBytes } from "node:crypto";
import { q, tx } from "./db";
import type { Business } from "./auth";

export type VisitResult = { ok: boolean; error?: string; customer?: string; progress?: number; goal?: number; reward_ready?: boolean };

const dayIn = (tz: string, d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d); // YYYY-MM-DD
const pending = (customerId: string) =>
  q.get<{ n: number }>("select count(*) n from visits where customer_id=? and voided_at is null and reward_id is null", customerId)!.n;

export function registerVisit(businessId: string, qr: string, staffId: string): VisitResult {
  return tx(() => {
    const b = q.get<Business>("select * from businesses where id=? and active=1", businessId);
    if (!b) return { ok: false, error: "negocio_inactivo" };
    const c = q.get<{ id: string; name: string }>("select id, name from customers where business_id=? and qr_code=?", businessId, qr.toUpperCase());
    if (!c) return { ok: false, error: "clienta_no_encontrada" };
    const day = dayIn(b.timezone);
    const today = q.get<{ n: number }>("select count(*) n from visits where customer_id=? and voided_at is null and local_day=?", c.id, day)!.n;
    if (today >= b.max_visits_per_day) return { ok: false, error: "limite_diario", customer: c.name };
    q.run("insert into visits(id,business_id,customer_id,staff_id,local_day) values (?,?,?,?,?)", crypto.randomUUID(), businessId, c.id, staffId, day);
    let progress = pending(c.id), ready = false;
    if (progress >= b.goal) {
      const rid = crypto.randomUUID();
      q.run("insert into rewards(id,business_id,customer_id,description) values (?,?,?,?)", rid, businessId, c.id, b.reward);
      q.run("update visits set reward_id=? where customer_id=? and voided_at is null and reward_id is null", rid, c.id);
      ready = true; progress = 0;
    }
    return { ok: true, customer: c.name, progress, goal: b.goal, reward_ready: ready };
  });
}

export function redeemReward(businessId: string, rewardId: string, staffId: string) {
  return tx(() => {
    const r = q.get<{ redeemed_at: string | null }>("select redeemed_at from rewards where id=? and business_id=?", rewardId, businessId);
    if (!r) return { ok: false, error: "no_encontrado" };
    if (r.redeemed_at) return { ok: false, error: "ya_canjeado" };
    q.run("update rewards set redeemed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), redeemed_by=? where id=?", staffId, rewardId);
    return { ok: true };
  });
}

export function voidVisit(businessId: string, visitId: string, staffId: string, reason: string) {
  return tx(() => {
    const v = q.get<{ voided_at: string | null; reward_id: string | null }>("select voided_at, reward_id from visits where id=? and business_id=?", visitId, businessId);
    if (!v) return { ok: false, error: "no_encontrada" };
    if (v.voided_at) return { ok: false, error: "ya_anulada" };
    if (v.reward_id) return { ok: false, error: "ya_en_beneficio" };
    q.run("update visits set voided_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), voided_by=?, void_reason=? where id=?", staffId, reason.slice(0, 200) || "sin motivo", visitId);
    return { ok: true };
  });
}

export const newCodes = () => ({
  card_token: randomBytes(24).toString("hex"),
  qr_code: randomBytes(8).toString("hex").toUpperCase(),
});
