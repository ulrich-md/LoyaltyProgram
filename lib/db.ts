import "server-only";
import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { hashPassword } from "./password";

export type Business = {
  id: string; slug: string; name: string; tagline: string; brand_primary: string; brand_soft: string;
  goal: number; reward: string; eligible_service: string; max_visits_per_day: number; timezone: string; active: boolean;
};
export type Role = "platform" | "admin" | "staff";
export type Customer = {
  id: string; business_id: string; name: string; email: string; phone: string | null;
  card_token: string; qr_code: string; created_at: string;
  progress: number; day: string; day_count: number; // visitas pendientes de beneficio; contador del día local
};
export type Reward = { id: string; business_id: string; customer_id: string; description: string; earned_at: string; redeemed_at: string | null; redeemed_by: string | null };

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const DEFAULT_BUSINESS = {
  tagline: "", brand_primary: "#b8416b", brand_soft: "#fbe3ea", goal: 6, reward: "Beneficio por definir",
  eligible_service: "Servicio elegible", max_visits_per_day: 1, timezone: "America/Costa_Rica", active: true,
};

const g = globalThis as unknown as { __fs?: Firestore; __ready?: Promise<void> };

function firestore(): Firestore {
  if (g.__fs) return g.__fs;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({ projectId: projectId ?? "demo-loyalty" });
    } else if (raw) {
      // JSON de la cuenta de servicio, tal cual o en base64
      const json = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
      initializeApp({ credential: cert(json) });
    } else if (projectId && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
    } else {
      throw new Error("Falta configurar Firebase: FIREBASE_SERVICE_ACCOUNT (o FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY)");
    }
  }
  g.__fs = getFirestore();
  return g.__fs;
}

/** Datos iniciales una sola vez por instancia: I Bloom y el usuario de plataforma. */
async function bootstrap(d: Firestore) {
  const ib = d.doc("businesses/ibloom");
  if (!(await ib.get()).exists) {
    await ib.create({ ...DEFAULT_BUSINESS, slug: "ibloom", name: "I Bloom Spa", tagline: "Tu bienestar tiene recompensa.", reward: "Facial de cortesía", eligible_service: "Faciales y masajes", created_at: new Date().toISOString() })
      .catch((e) => { if (e.code !== 6) throw e; });
  }
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase(), pass = process.env.BOOTSTRAP_PASSWORD;
  if (email && pass && (await d.collection("users").where("role", "==", "platform").limit(1).get()).empty) {
    await d.doc(`users/${sha(email)}`).set({ email, password_hash: hashPassword(pass), role: "platform", business_id: null, created_at: new Date().toISOString() });
  }
}

/** Devuelve Firestore listo para usar (esquema inicial creado). */
export async function db(): Promise<Firestore> {
  const d = firestore();
  g.__ready ??= bootstrap(d).catch((e) => { g.__ready = undefined; throw e; });
  await g.__ready;
  return d;
}
