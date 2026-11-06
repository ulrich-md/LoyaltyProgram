import { requireStaff } from "@/lib/auth";
import { q as db } from "@/lib/db";
import { redeemReward } from "../actions";

export const dynamic = "force-dynamic";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireStaff(["admin", "staff"]);
  const { q } = await searchParams;
  const like = `%${(q ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const customers = db.all<{ id: string; name: string; email: string; qr_code: string }>(
    "select id, name, email, qr_code from customers where business_id=? and (name like ? escape '\\' or email like ? escape '\\') order by created_at desc limit 50",
    s.business!.id, like, like);
  const visits = db.all<{ customer_id: string; n: number }>(
    "select customer_id, count(*) n from visits where business_id=? and voided_at is null and reward_id is null group by customer_id", s.business!.id);
  const rewards = db.all<{ id: string; customer_id: string; description: string }>(
    "select id, customer_id, description from rewards where business_id=? and redeemed_at is null", s.business!.id);
  const progress = (id: string) => visits.find((v) => v.customer_id === id)?.n ?? 0;
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
