import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { q, tx } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { logout } from "../panel/actions";

async function createBusiness(fd: FormData) {
  "use server";
  await requireStaff(["platform"]);
  const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(80) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  try { await q.run("insert into businesses(slug,name) values ($1,$2)", p.data.slug, p.data.name); } catch { /* slug duplicado */ }
  revalidatePath("/plataforma");
}

async function addStaff(fd: FormData) {
  "use server";
  await requireStaff(["platform"]);
  const p = z.object({
    business_id: z.string().uuid(), email: z.string().trim().toLowerCase().email(),
    password: z.string().min(10).max(72), role: z.enum(["admin", "staff"]),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  try {
    await tx(async (t) => {
      const u = (await t.get<{ id: string }>("insert into users(email,password_hash) values ($1,$2) returning id", p.data.email, hashPassword(p.data.password)))!;
      await t.run("insert into memberships(user_id,business_id,role) values ($1,$2,$3)", u.id, p.data.business_id, p.data.role);
    });
  } catch { return; /* correo ya existe */ }
  revalidatePath("/plataforma");
}

export default async function Plataforma() {
  await requireStaff(["platform"]);
  const businesses = await q.all<{ id: string; slug: string; name: string }>("select id, slug, name from businesses order by created_at");
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex justify-between"><h1 className="text-xl font-bold">Plataforma</h1><form action={logout}><button className="underline">Salir</button></form></div>
      <form action={createBusiness} className="card flex gap-2">
        <input className="input" name="slug" placeholder="slug (ibloom)" required />
        <input className="input" name="name" placeholder="Nombre del negocio" required />
        <button className="btn">Crear</button>
      </form>
      <form action={addStaff} className="card space-y-2">
        <h2 className="font-semibold">Agregar personal</h2>
        <select className="input" name="business_id" required>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input className="input" name="email" type="email" placeholder="Correo" required />
        <input className="input" name="password" type="password" placeholder="Contraseña temporal (mín. 10)" minLength={10} required />
        <select className="input" name="role"><option value="staff">Personal (escanea)</option><option value="admin">Administradora</option></select>
        <button className="btn w-full">Crear usuario</button>
      </form>
      <ul className="space-y-2">{businesses.map((b) => <li key={b.id} className="card">{b.name} — <code>/registro/{b.slug}</code></li>)}</ul>
    </main>
  );
}
