"use client";
import { use, useEffect, useState } from "react";
import { Coffee, Gift, RefreshCw } from "lucide-react";
import {
  api,
  Badge,
  Brand,
  DateText,
  Notice,
  QR,
  Stamps,
} from "@/components/ui";
import type { Business, Customer, Reward, Movement, Card } from "@/lib/types";
type Data = {
  business: Business;
  customer: Customer;
  rewards: Reward[];
  movements: Movement[];
  wallet: Card[];
};
export default function CardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [d, setD] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<Data>("card/" + token).then((x) => {
      if (!x) throw Error("No encontramos esta tarjeta. Revisa tu enlace.");
      setD(x);
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const id = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [token]);
  return (
    <main className="center-page">
      <div className="center-head">
        <Brand />
        <Badge />
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {d && (
        <>
          <div className="public-intro">
            <p className="eyebrow">Tu tarjeta de lealtad</p>
            <h1>Hola, {d.customer.name.split(" ")[0]}.</h1>
            <p>Cada visita cuenta. Gracias por volver.</p>
          </div>
          <div
            className="card-preview"
            style={{ background: d.business.color }}
          >
            <div className="card-brand">
              <Coffee size={27} />
              {d.business.name}
            </div>
            <h3>{d.business.program}</h3>
            <p>{d.customer.cycle_reward}</p>
            <Stamps count={d.customer.stamps} goal={d.customer.cycle_goal} />
            <div className="card-bottom">
              <span>{d.customer.name}</span>
              <strong>
                {d.customer.stamps} / {d.customer.cycle_goal} sellos
              </strong>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 20, textAlign: "center" }}>
            <h2>Un sello más cerca de tu recompensa</h2>
            <p className="small muted">
              Muestra este QR en caja después de tu compra.
            </p>
            <QR value={"sello:" + d.customer.scan_token} />
            <p className="small muted" style={{ marginTop: 16 }}>
              Conserva este enlace: es el acceso privado a tu tarjeta.
            </p>
          </div>
          {d.rewards
            .filter((r) => r.state === "available")
            .map((r) => (
              <div className="reward-item" key={r.id}>
                <h3>
                  <Gift size={17} style={{ display: "inline" }} /> Tienes una
                  recompensa
                </h3>
                <p>{r.description}</p>
                <p className="muted">{r.terms}</p>
                <p className="small">
                  Solicita el canje en caja · Demostración
                </p>
              </div>
            ))}
          <div className="panel">
            <h2>Lleva tu tarjeta contigo</h2>
            {d.wallet
              .filter((w) => w.distribution_url)
              .map((w) => (
                <a
                  className="button"
                  key={w.provider}
                  href={w.distribution_url!}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir enlace de Wallet
                </a>
              ))}
            {d.business.provider === "pass_studio" ? (
              <button
                style={{ width: "100%" }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api("wallet", { token });
                    setMessage(
                      r.url
                        ? "Tu tarjeta ya tiene un enlace de Wallet."
                        : "Solicitud registrada. Tu tarjeta web está lista.",
                    );
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Solicitando…"
                  : "Solicitar Apple Wallet o Google Wallet"}
              </button>
            ) : (
              <p className="muted small">
                Apple Wallet y Google Wallet aún no están habilitados por el
                negocio. Puedes usar esta tarjeta web.
              </p>
            )}
            {d.wallet.some((w) => w.status !== "synced") && (
              <p className="small muted">
                Wallet pendiente de sincronización. Tus sellos están guardados.
              </p>
            )}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Tus movimientos</h2>
              <button
                className="ghost"
                aria-label="Actualizar tarjeta"
                onClick={() => load().catch((e) => setError(e.message))}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            {d.movements.slice(0, 12).map((m, i) => (
              <div className="activity" key={i}>
                <div className="avatar">{m.kind === "stamp" ? "+1" : "↺"}</div>
                <div className="details">
                  <p>
                    {m.kind === "stamp"
                      ? "Sello recibido"
                      : m.kind === "redeem"
                        ? "Recompensa canjeada"
                        : "Movimiento corregido"}
                  </p>
                  <small>
                    <DateText value={m.created_at} />
                  </small>
                </div>
              </div>
            ))}
            {!d.movements.length && (
              <p className="muted">Tu primera visita está por llegar.</p>
            )}
          </div>
          <details className="panel">
            <summary>Condiciones de tu ciclo</summary>
            <p className="small" style={{ marginTop: 15 }}>
              {d.customer.cycle_terms}
            </p>
          </details>
        </>
      )}
      <footer className="public-footer">
        Recompensas ficticias para demostración.
        <br />
        ¿Perdiste tu enlace? <a href="/recuperar">Recuperar tarjeta</a>
      </footer>
    </main>
  );
}
