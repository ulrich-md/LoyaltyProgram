import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { admin } from "@/lib/supabase";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional(),
});

async function register(slug: string, fd: FormData) {
  "use server";
  const parsed = schema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined });
  if (!parsed.success) redirect(`/registro/${slug}?error=datos`);
  const db = admin();
  const { data: b } = await db.from("businesses").select("id").eq("slug", slug).eq("active", true).single();
  if (!b) notFound();
  const { data, error } = await db.from("customers")
    .insert({ business_id: b.id, ...parsed.data }).select("card_token").single();
  // Correo ya registrado: no revelamos la tarjeta existente.
  if (error?.code === "23505") redirect(`/registro/${slug}?error=existe`);
  if (error || !data) redirect(`/registro/${slug}?error=datos`);
  redirect(`/tarjeta/${data.card_token}`);
}

export default async function Registro({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { data: b } = await admin().from("businesses").select("name, tagline, brand_primary, brand_soft, goal, reward").eq("slug", slug).eq("active", true).single();
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
