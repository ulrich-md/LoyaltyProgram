"use client";
import { useState } from "react";
import { api, Badge, Brand, Notice } from "@/components/ui";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="center-page login">
      <div className="center-head">
        <Brand />
        <Badge />
      </div>
      <div className="panel">
        <p className="eyebrow">Bienvenido a tu negocio</p>
        <h1>Los buenos momentos se repiten.</h1>
        <p className="muted">
          Entra para cuidar de tus clientes, un sello a la vez.
        </p>
        {error && <Notice error>{error}</Notice>}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("login", {
                email: f.get("email"),
                password: f.get("password"),
              });
              location.href = "/";
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Correo electrónico
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Entrando…" : "Entrar al panel →"}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 20 }}>
          ¿Tienes una tarjeta? <a href="/recuperar">Recupera tu acceso</a>
        </p>
      </div>
      <div className="public-footer">
        Hecho para los negocios que crean comunidad.
      </div>
    </main>
  );
}
