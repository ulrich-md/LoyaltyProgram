import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Cliente con service role: solo servidor. Ignora RLS. */
export function admin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente ligado a las cookies de sesión del personal. */
export async function sessionClient() {
  const jar = await cookies();
  return createServerClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* render de servidor */ }
      },
    },
  });
}
