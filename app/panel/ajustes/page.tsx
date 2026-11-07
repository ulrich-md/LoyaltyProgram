import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { updateBusiness } from "@/lib/store";

const schema = z.object({
  tagline: z.string().trim().max(120),
  goal: z.coerce.number().int().min(2).max(20),
  reward: z.string().trim().min(2).max(120),
  eligible_service: z.string().trim().min(2).max(120),
  max_visits_per_day: z.coerce.number().int().min(1).max(10),
  brand_primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brand_soft: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

async function save(fd: FormData) {
  "use server";
  const s = await requireStaff(["admin"]);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return;
  const d = parsed.data;
  await updateBusiness(s.business!.id, d);
  revalidatePath("/panel", "layout");
}

export default async function Ajustes() {
  const s = await requireStaff(["admin"]);
  const b = s.business!;
  const f = "block text-sm font-medium";
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Ajustes del programa</h1>
      <p className="mb-4 text-sm">Enlace de registro: <code>/registro/{b.slug}</code></p>
      <form action={save} className="card space-y-3">
        <label className={f}>Frase<input className="input" name="tagline" defaultValue={b.tagline} /></label>
        <label className={f}>Visitas para el beneficio<input className="input" name="goal" type="number" min={2} max={20} defaultValue={b.goal} /></label>
        <label className={f}>Beneficio<input className="input" name="reward" defaultValue={b.reward} /></label>
        <label className={f}>Servicio elegible<input className="input" name="eligible_service" defaultValue={b.eligible_service} /></label>
        <label className={f}>Máx. visitas por día<input className="input" name="max_visits_per_day" type="number" min={1} max={10} defaultValue={b.max_visits_per_day} /></label>
        <div className="flex gap-4">
          <label className={f}>Color principal<input name="brand_primary" type="color" defaultValue={b.brand_primary} /></label>
          <label className={f}>Color suave<input name="brand_soft" type="color" defaultValue={b.brand_soft} /></label>
        </div>
        <p className="text-xs text-neutral-500">Cambiar la meta aplica a las visitas acumuladas en adelante.</p>
        <button className="btn w-full">Guardar</button>
      </form>
    </>
  );
}
