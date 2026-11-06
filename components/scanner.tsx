"use client";
import { useEffect, useRef, useState } from "react";
export default function Scanner({ onScan }: { onScan: (v: string) => void }) {
  const [error, setError] = useState("");
  const callback = useRef(onScan);
  callback.current = onScan;
  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let gone = false;
    async function start() {
      try {
        if (!window.isSecureContext)
          throw Error(
            "La cámara requiere HTTPS. Utiliza la búsqueda manual en este dispositivo.",
          );
        const { Html5Qrcode } = await import("html5-qrcode");
        if (gone) return;
        scanner = new Html5Qrcode("reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (!gone) {
              gone = true;
              callback.current(text);
            }
          },
          () => {},
        );
        if (gone && scanner.isScanning) await scanner.stop();
      } catch (e) {
        if (!gone)
          setError(
            e instanceof Error && e.message.includes("HTTPS")
              ? e.message
              : "No pudimos abrir la cámara. Permite su uso en el navegador o busca al cliente por correo o teléfono.",
          );
      }
    }
    void start();
    return () => {
      gone = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, []);
  return (
    <div>
      <div id="reader" className="reader" />
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
