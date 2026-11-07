import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getActiveBusiness, registerCustomer } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional(),
});

async function register(slug: string, fd: FormData) {
  "use server";
  const parsed = schema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined });
  if (!parsed.success) redirect(`/registro/${slug}?error=datos`);
  const b = await getActiveBusiness(slug);
  if (!b) notFound();
  const token = await registerCustomer(b.id, parsed.data);
  // Correo ya registrado: no revelamos la tarjeta existente.
  if (!token) redirect(`/registro/${slug}?error=existe`);
  redirect(`/tarjeta/${token}`);
}

export default async function Registro({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const b = await getActiveBusiness(slug);
  if (!b) notFound();
  return (
    <main className="min-h-screen p-6" style={{ background: b.brand_soft, ["--brand" as string]: b.brand_primary }}>
      <div className="mx-auto max-w-sm pt-12">
        <h1 className="text-3xl font-bold" style={{ color: b.brand_primary }}>{b.name}</h1>
        <p className="mt-2">{b.tagline}</p>
        <p className="mt-4 text-sm">Acumula {b.goal} visitas y recibe: <strong>{b.reward}</strong>.</p>
        <form action={register.bind(null, slug)} className="card mt-6 space-y-3">
          <input className="input" name="name" placeholder="Nombre completo" required minLength={2} />
          <input className="input" name="email" type="email" placeholder="Correo" required />
          <input className="input" name="phone" type="tel" placeholder="Teléfono (opcional)" />
          {error === "existe" && <p className="text-sm text-red-600">Ese correo ya tiene una tarjeta. Pide tu enlace al personal.</p>}
          {error === "datos" && <p className="text-sm text-red-600">Revisa los datos e inténtalo de nuevo.</p>}
          <button className="btn w-full">Obtener mi tarjeta</button>
        </form>
      </div>
    </main>
  );
}
