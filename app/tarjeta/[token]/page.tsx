import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { admin } from "@/lib/supabase";
import { ProgressDots } from "@/components/ProgressDots";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Tarjeta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();
  const { data: c } = await db.from("customers").select("id, name, qr_code, serial, business_id").eq("card_token", token).single();
  if (!c) notFound();
  const [{ data: b }, { count }, { data: rewards }] = await Promise.all([
    db.from("businesses").select("name, brand_primary, brand_soft, goal, reward").eq("id", c.business_id).single(),
    db.from("visits").select("id", { count: "exact", head: true }).eq("customer_id", c.id).is("voided_at", null).is("reward_id", null),
    db.from("rewards").select("id, description, earned_at").eq("customer_id", c.id).is("redeemed_at", null),
  ]);
  if (!b) notFound();
  const qr = await QRCode.toDataURL(c.qr_code, { margin: 1, width: 360 });
  return (
    <main className="min-h-screen p-4" style={{ background: b.brand_soft }}>
      <div className="mx-auto max-w-sm rounded-3xl p-6 shadow-lg" style={{ background: "white", border: `2px solid ${b.brand_primary}22` }}>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold" style={{ color: b.brand_primary }}>{b.name}</h1>
          <div className="text-right"><p className="text-[10px] tracking-widest">VISITAS</p><p className="text-2xl font-semibold">{count ?? 0}/{b.goal}</p></div>
        </div>
        <div className="my-6 rounded-2xl p-4" style={{ background: b.brand_soft }}>
          <ProgressDots done={count ?? 0} goal={b.goal} color={b.brand_primary} />
        </div>
        <p className="text-[10px] tracking-widest">CLIENTA</p><p className="font-medium">{c.name}</p>
        <p className="mt-3 text-[10px] tracking-widest">BENEFICIO</p><p className="font-medium">{b.reward}</p>
        {rewards && rewards.length > 0 && (
          <p className="mt-4 rounded-xl p-3 text-center font-semibold text-white" style={{ background: b.brand_primary }}>
            🎉 Tenés {rewards.length} beneficio{rewards.length > 1 ? "s" : ""} disponible{rewards.length > 1 ? "s" : ""}: mostralo en caja.
          </p>
        )}
        <div className="mt-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR de tu tarjeta" className="size-44 rounded-xl border p-1" />
          <p className="mt-1 font-mono text-xs">{c.qr_code}</p>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-sm text-center text-xs text-neutral-500">Guarda este enlace: es tu tarjeta. No lo compartas.</p>
    </main>
  );
}
