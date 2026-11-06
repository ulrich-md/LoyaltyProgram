import "server-only";
import postgres from "postgres";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
export const local = () =>
  process.env.LOCAL_DEMO === "true" && process.env.NODE_ENV !== "production";
let pool: ReturnType<typeof postgres>;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Configura la base de datos");
  return (pool ??= postgres(process.env.DATABASE_URL, { max: 8 }));
}
export async function supabase() {
  const jar = await cookies();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
    throw new Error("Falta configurar Supabase");
  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          for (const { name, value, options } of values)
            jar.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === "production",
              httpOnly: true,
              sameSite: "lax",
            });
        },
      },
    },
  );
}
export function service() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Falta la credencial de administración");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function actor() {
  if (local()) {
    const token = (await cookies()).get("demo_session")?.value;
    if (!token) return null;
    const [s] =
      await db()`select user_id from demo_sessions where token_hash=${hash(token)} and expires_at>now()`;
    return (s?.user_id as string) || null;
  }
  const s = await supabase();
  const {
    data: { user },
  } = await s.auth.getUser();
  return user?.id || null;
}
export async function rpc(
  name: string,
  args: Record<string, unknown> = {},
  user?: string | null,
) {
  if (local()) {
    if (!/^[a-z_]+$/.test(name)) throw Error("RPC inválido");
    const entries = Object.entries(args);
    return db().begin(async (sql) => {
      await sql`select set_config('request.jwt.claim.sub',${user || ""},true)`;
      const q = `select ${name}(${entries.map(([k], i) => `${k} => $${i + 1}`).join(",")}) as result`;
      const [row] = await sql.unsafe(
        q,
        entries.map(([, v]) =>
          v === undefined
            ? null
            : typeof v === "object" && v !== null
              ? JSON.stringify(v)
              : v,
        ) as never[],
      );
      return row.result;
    });
  }
  const s = await supabase();
  const { data, error } = await s.rpc(name, args);
  if (error) throw Error(error.message);
  return data;
}
export async function requireActor() {
  const id = await actor();
  if (!id) throw Error("Sesión requerida");
  return id;
}
export function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds = 900,
) {
  const key = hash(bucket);
  let allowed;
  if (local()) {
    const [r] =
      await db()`select consume_rate(${key},${limit},${windowSeconds}) as allowed`;
    allowed = r.allowed;
  } else {
    const { data, error } = await service().rpc("consume_rate", {
      p_bucket: key,
      p_limit: limit,
      p_window: windowSeconds,
    });
    if (error) throw Error("Limitador no disponible");
    allowed = data;
  }
  if (!allowed)
    throw Error(
      "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
    );
}
