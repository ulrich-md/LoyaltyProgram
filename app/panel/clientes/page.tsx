import { requireStaff } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { redeemReward } from "../actions";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireStaff(["admin", "staff"]);
  const { q } = await searchParams;
  const db = admin();
  let query = db.from("customers").select("id, name, email, qr_code, created_at").eq("business_id", s.business!.id).order("created_at", { ascending: false }).limit(50);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: customers } = await query;
  const ids = (customers ?? []).map((c) => c.id);
  const [{ data: visits }, { data: rewards }] = await Promise.all([
    db.from("visits").select("customer_id").in("customer_id", ids).is("voided_at", null).is("reward_id", null),
    db.from("rewards").select("id, customer_id, description").in("customer_id", ids).is("redeemed_at", null),
  ]);
  const progress = (id: string) => visits?.filter((v) => v.customer_id === id).length ?? 0;
  return (
    <>
      <form className="mb-4"><input className="input" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" /></form>
      <ul className="space-y-3">
        {customers?.map((c) => (
          <li key={c.id} className="card">
            <div className="flex justify-between"><strong>{c.name}</strong><span>{progress(c.id)}/{s.business!.goal}</span></div>
            <p className="text-sm text-neutral-500">{c.email} · <span className="font-mono">{c.qr_code}</span></p>
            {rewards?.filter((r) => r.customer_id === c.id).map((r) => (
              <form key={r.id} action={async () => { "use server"; await redeemReward(r.id); }} className="mt-2">
                <button className="btn w-full">Canjear: {r.description}</button>
              </form>
            ))}
          </li>
        ))}
        {customers?.length === 0 && <p className="text-neutral-500">Sin resultados.</p>}
      </ul>
    </>
  );
}
