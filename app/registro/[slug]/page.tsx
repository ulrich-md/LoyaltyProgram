"use client";
import { use, useEffect, useState } from "react";
import { Coffee, ArrowRight } from "lucide-react";
import { api, Badge, Brand, Notice } from "@/components/ui";
import type { Business } from "@/lib/types";
export default function Register({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [b, setB] = useState<Business | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [existing, setExisting] = useState(false);
  useEffect(() => {
    api<Business>("program/" + slug)
      .then((x) => {
        if (!x) throw Error("Este programa no está disponible.");
        setB(x);
      })
      .catch((e) => setError(e.message));
  }, [slug]);
  return (
    <main className="center-page">
      <div className="center-head">
        <Brand />
        <Badge />
      </div>
      {error && <Notice error>{error}</Notice>}
      {b && (
        <>
          <div className="public-intro">
            <div className="coffee-logo">
              {b.logo ? (
                <img
                  src={b.logo}
                  alt={b.name}
                  width={70}
                  height={70}
                  style={{ margin: "auto" }}
                />
              ) : (
                <Coffee size={45} style={{ margin: "auto" }} />
              )}
            </div>
            <p className="eyebrow">{b.name}</p>
            <h1>{b.program}</h1>
            <p>
              Junta {b.goal} sellos y disfruta de
              <br />
              <strong>{b.reward}</strong>
            </p>
          </div>
          {existing ? (
            <div className="panel">
              <h2>Tu correo ya está registrado</h2>
              <p>
                Por seguridad, recupera tu tarjeta con un enlace enviado a tu
                correo.
              </p>
              <a className="button" href="/recuperar">
                Recuperar tarjeta
              </a>
            </div>
          ) : (
            <form
              className="panel stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const f = new FormData(e.currentTarget);
                try {
                  const d = await api("register", {
                    slug,
                    name: f.get("name"),
                    email: f.get("email"),
                    phone: f.get("phone"),
                    accept: f.get("accept") === "on",
                    marketing: f.get("marketing") === "on",
                  });
                  if (d.existing) setExisting(true);
                  else location.href = "/tarjeta/" + d.token;
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2 style={{ marginBottom: 0 }}>Tu próxima pausa empieza aquí</h2>
              <label>
                Tu nombre
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  placeholder="¿Cómo te llamas?"
                  required
                />
              </label>
              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  required
                />
              </label>
              <label>
                Teléfono <span className="muted">Opcional</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  maxLength={30}
                  placeholder="55 1234 5678"
                />
              </label>
              <details className="info-box">
                <summary>Condiciones del programa</summary>
                <p>{b.terms}</p>
              </details>
              <details className="info-box" open>
                <summary>Aviso de privacidad</summary>
                <p>{b.privacy}</p>
              </details>
              <label className="check-label">
                <input type="checkbox" name="accept" required />
                Acepto las condiciones del programa. He leído el aviso de
                privacidad.
              </label>
              <label className="check-label">
                <input type="checkbox" name="marketing" />
                Quiero recibir novedades del negocio (opcional).
              </label>
              <button disabled={busy} style={{ background: b.color }}>
                {busy ? "Creando tu tarjeta…" : "Crear mi tarjeta"}
                <ArrowRight size={17} />
              </button>
              <p className="small muted">
                Demostración: las recompensas son ficticias y no tienen valor
                comercial.
              </p>
            </form>
          )}
        </>
      )}
      <footer className="public-footer">
        Tu lealtad merece algo bueno. Con sello.
      </footer>
    </main>
  );
}
