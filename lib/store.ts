import "server-only";
import { randomBytes } from "node:crypto";
import { DEFAULT_BUSINESS, db, sha, type Business, type Customer, type Reward, type Role } from "./db";

const ALREADY_EXISTS = 6;
const idOk = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);

export const newCodes = () => ({ card_token: randomBytes(24).toString("hex"), qr_code: randomBytes(8).toString("hex").toUpperCase() });

export async function getBusiness(id: string): Promise<Business | null> {
  if (!idOk(id)) return null;
  const s = await (await db()).doc(`businesses/${id}`).get();
  return s.exists ? ({ id: s.id, ...s.data() } as Business) : null;
}
export async function getActiveBusiness(slug: string) { const b = await getBusiness(slug); return b?.active ? b : null; }

export async function listBusinesses(): Promise<Business[]> {
  const s = await (await db()).collection("businesses").get();
  return s.docs.map((x) => ({ id: x.id, ...x.data() }) as Business).sort((a, b) => a.name.localeCompare(b.name));
}

/** El slug es el id del negocio, así que es único por construcción. */
export async function createBusiness(slug: string, name: string) {
  try { await (await db()).doc(`businesses/${slug}`).create({ ...DEFAULT_BUSINESS, slug, name, created_at: new Date().toISOString() }); return true; }
  catch (e) { if ((e as { code?: number }).code === ALREADY_EXISTS) return false; throw e; }
}

export async function updateBusiness(id: string, patch: Partial<Business>) {
  await (await db()).doc(`businesses/${id}`).update(patch);
}

/** Crea personal; el id del usuario es el hash del correo, lo que impide duplicados. */
export async function createStaff(email: string, passwordHash: string, role: Exclude<Role, "platform">, businessId: string) {
  if (!(await getBusiness(businessId))) return false;
  try { await (await db()).doc(`users/${sha(email)}`).create({ email, password_hash: passwordHash, role, business_id: businessId, created_at: new Date().toISOString() }); return true; }
  catch (e) { if ((e as { code?: number }).code === ALREADY_EXISTS) return false; throw e; }
}

/** Registra una clienta. Devuelve el token de su tarjeta, o null si el correo ya existe en ese negocio. */
export async function registerCustomer(businessId: string, data: { name: string; email: string; phone?: string }) {
  const d = await db(), codes = newCodes();
  const ref = d.collection("customers").doc();
  const key = d.doc(`customerKeys/${businessId}__${sha(data.email)}`);
  try {
    await d.runTransaction(async (t) => {
      if ((await t.get(key)).exists) throw Object.assign(new Error("dup"), { dup: true });
      t.create(key, { customer_id: ref.id });
      t.create(ref, { business_id: businessId, name: data.name, email: data.email, phone: data.phone ?? null, ...codes, created_at: new Date().toISOString(), progress: 0, day: "", day_count: 0 });
    });
  } catch (e) { if ((e as { dup?: boolean }).dup) return null; throw e; }
  return codes.card_token;
}

export async function getCard(token: string) {
  const d = await db();
  const cs = await d.collection("customers").where("card_token", "==", token).limit(1).get();
  if (cs.empty) return null;
  const c = { id: cs.docs[0].id, ...cs.docs[0].data() } as Customer;
  const business = await getBusiness(c.business_id);
  if (!business) return null;
  const rs = await d.collection("rewards").where("customer_id", "==", c.id).where("redeemed_at", "==", null).get();
  return { customer: c, business, pendingRewards: rs.size };
}

/** Clientas del negocio (más recientes primero) con búsqueda por nombre o correo en memoria. */
export async function listCustomers(businessId: string, search = "", max = 1000): Promise<Customer[]> {
  const s = await (await db()).collection("customers").where("business_id", "==", businessId).limit(max).get();
  const needle = search.trim().toLowerCase();
  return s.docs.map((x) => ({ id: x.id, ...x.data() }) as Customer)
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.email.includes(needle))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

export async function listPendingRewards(businessId: string): Promise<Reward[]> {
  const s = await (await db()).collection("rewards").where("business_id", "==", businessId).where("redeemed_at", "==", null).get();
  return s.docs.map((x) => ({ id: x.id, ...x.data() }) as Reward);
}
