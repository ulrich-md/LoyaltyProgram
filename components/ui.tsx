"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Coffee, Check } from "lucide-react";
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "No se pudo completar");
  return d;
}
export function QR({
  value,
  download = false,
}: {
  value: string;
  download?: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then(setUrl);
  }, [value]);
  return url ? (
    <div className="qr">
      <img src={url} alt="Código QR" width={180} height={180} />
      {download && (
        <a download="registro-qr.png" href={url}>
          Descargar QR
        </a>
      )}
    </div>
  ) : (
    <span>Preparando QR…</span>
  );
}
export function Stamps({ count, goal }: { count: number; goal: number }) {
  return (
    <div className="stamps">
      {Array.from({ length: goal }, (_, i) => (
        <div className={i < count ? "stamp filled" : "stamp"} key={i}>
          {i < count ? <Coffee size={24} /> : <span>{i + 1}</span>}
        </div>
      ))}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={"notice " + (error ? "error" : "")}
    >
      {children}
    </div>
  );
}
export function Badge() {
  return <span className="demo">Demostración</span>;
}
export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-icon">
        <Coffee size={23} />
      </span>{" "}
      sello<span className="brand-dot">.</span>
    </a>
  );
}
export function DateText({ value }: { value: string }) {
  return (
    <>
      {new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date(value))}
    </>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Check size={26} />
      <p>{text}</p>
    </div>
  );
}
