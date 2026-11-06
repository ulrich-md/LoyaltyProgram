import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase";

async function login(fd: FormData) {
  "use server";
  const sb = await sessionClient();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("password")) });
  if (error) redirect("/login?error=1");
  redirect("/panel");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6 pt-20">
      <h1 className="mb-6 text-2xl font-bold">Acceso del personal</h1>
      <form action={login} className="card space-y-3">
        <input className="input" name="email" type="email" placeholder="Correo" required autoComplete="email" />
        <input className="input" name="password" type="password" placeholder="Contraseña" required autoComplete="current-password" />
        {error && <p className="text-sm text-red-600">Correo o contraseña incorrectos.</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </main>
  );
}
