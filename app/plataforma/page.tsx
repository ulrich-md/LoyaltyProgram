import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { logout } from "../panel/actions";

async function createBusiness(fd: FormData) {
  "use server";
  await requireStaff(["platform"]);
  const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(80) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  await admin().from("businesses").insert(p.data);
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
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({ email: p.data.email, password: p.data.password, email_confirm: true });
  if (error || !data.user) return;
  await db.from("memberships").insert({ user_id: data.user.id, business_id: p.data.business_id, role: p.data.role, email: p.data.email });
  revalidatePath("/plataforma");
}

export default async function Plataforma() {
  await requireStaff(["platform"]);
  const { data: businesses } = await admin().from("businesses").select("id, slug, name").order("created_at");
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
        <select className="input" name="business_id" required>{businesses?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <input className="input" name="email" type="email" placeholder="Correo" required />
        <input className="input" name="password" type="password" placeholder="Contraseña temporal (mín. 10)" minLength={10} required />
        <select className="input" name="role"><option value="staff">Personal (escanea)</option><option value="admin">Administradora</option></select>
        <button className="btn w-full">Crear usuario</button>
      </form>
      <ul className="space-y-2">{businesses?.map((b) => <li key={b.id} className="card">{b.name} — <code>/registro/{b.slug}</code></li>)}</ul>
    </main>
  );
}
