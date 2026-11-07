import { requireStaff } from "@/lib/auth";
import { listCustomers, listPendingRewards } from "@/lib/store";
import { redeemReward } from "../actions";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireStaff(["admin", "staff"]);
  const { q } = await searchParams;
  const customers = await listCustomers(s.business!.id, q);
  const rewards = await listPendingRewards(s.business!.id);
  const progress = (id: string) => customers.find((c) => c.id === id)?.progress ?? 0;
  return (
    <>
      <form className="mb-4"><input className="input" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" /></form>
      <ul className="space-y-3">
        {customers.map((c) => (
          <li key={c.id} className="card">
            <div className="flex justify-between"><strong>{c.name}</strong><span>{progress(c.id)}/{s.business!.goal}</span></div>
            <p className="text-sm text-neutral-500">{c.email} · <span className="font-mono">{c.qr_code}</span></p>
            {rewards.filter((r) => r.customer_id === c.id).map((r) => (
              <form key={r.id} action={async () => { "use server"; await redeemReward(r.id); }} className="mt-2">
                <button className="btn w-full">Canjear: {r.description}</button>
              </form>
            ))}
          </li>
        ))}
        {customers.length === 0 && <p className="text-neutral-500">Sin resultados.</p>}
      </ul>
    </>
  );
}
