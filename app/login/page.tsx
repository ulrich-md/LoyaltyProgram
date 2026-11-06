import { redirect } from "next/navigation";
import { getStaff, login } from "@/lib/auth";

async function doLogin(fd: FormData) {
  "use server";
  const ok = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  redirect(ok ? "/panel" : "/login?error=1");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaff()) redirect("/panel");
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6 pt-20">
      <h1 className="mb-6 text-2xl font-bold">Acceso del personal</h1>
      <form action={doLogin} className="card space-y-3">
        <input className="input" name="email" type="email" placeholder="Correo" required autoComplete="email" />
        <input className="input" name="password" type="password" placeholder="Contraseña" required autoComplete="current-password" />
        {error && <p className="text-sm text-red-600">Correo o contraseña incorrectos, o demasiados intentos. Espera unos minutos.</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </main>
  );
}
