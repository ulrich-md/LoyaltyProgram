import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Diagnóstico de conexión. No expone cadenas de conexión ni contraseñas. */
export async function GET() {
  const env = { DATABASE_URL: !!process.env.DATABASE_URL, BOOTSTRAP_EMAIL: !!process.env.BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD: !!process.env.BOOTSTRAP_PASSWORD };
  try {
    const r = await q.get<{ n: number }>("select count(*)::int n from businesses");
    return Response.json({ ok: true, env, businesses: r?.n });
  } catch (e) {
    const err = e as { code?: string; name?: string };
    return Response.json({ ok: false, env, error: { name: err.name ?? "Error", code: err.code ?? null } }, { status: 500 });
  }
}
