"use client";
import { useEffect, useState } from "react";
import { api, Badge, Brand, Notice } from "@/components/ui";
export default function Recovery() {
  const [msg, setMsg] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cards, setCards] = useState<
      { access_token: string; businesses: { name: string } }[]
    >([]);
  useEffect(() => {
    api("recovery-cards")
      .then(setCards)
      .catch(() => {});
  }, []);
  return (
    <main className="center-page">
      <div className="center-head">
        <Brand />
        <Badge />
      </div>
      <div className="panel stack">
        <h1>Vuelve a tu tarjeta</h1>
        <p className="muted">
          Te enviaremos un enlace seguro. Tu correo nunca funciona como
          contraseña.
        </p>
        {msg && <Notice>{msg}</Notice>}
        {error && <Notice error>{error}</Notice>}
        {cards.map((c) => (
          <a
            className="button"
            href={"/tarjeta/" + c.access_token}
            key={c.access_token}
          >
            {c.businesses.name} →
          </a>
        ))}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("recover", {
                email: new FormData(e.currentTarget).get("email"),
              });
              setMsg(
                "Revisa tu correo y abre el enlace en este mismo navegador.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Correo electrónico
            <input type="email" name="email" required />
          </label>
          <button disabled={busy}>
            {busy ? "Enviando…" : "Enviar enlace seguro"}
          </button>
        </form>
        <a className="small muted" href="/">
          Volver al panel
        </a>
      </div>
    </main>
  );
}
