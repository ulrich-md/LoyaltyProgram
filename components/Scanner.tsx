"use client";
import { useEffect, useRef, useState } from "react";
import { registerVisit } from "@/app/panel/actions";
import type { VisitResult } from "@/lib/ops";

type Result = VisitResult;
const errors: Record<string, string> = {
  codigo_invalido: "Código no válido.", clienta_no_encontrada: "Clienta no encontrada en este negocio.",
  limite_diario: "Ya tiene la visita de hoy registrada.", negocio_inactivo: "Negocio inactivo.", error_servidor: "Error del servidor.",
};

export function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const lock = useRef(false);

  async function submit(code: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { setResult(await registerVisit(code)); } finally { setBusy(false); setTimeout(() => (lock.current = false), 2500); }
  }

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode("reader");
      try {
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => submit(text), () => {});
      } catch { setCameraError(true); }
    })();
    return () => { cancelled = true; scanner?.isScanning && scanner.stop().catch(() => {}); };
  }, []);

  return (
    <div className="space-y-4">
      <div id="reader" className="overflow-hidden rounded-2xl bg-black/5" />
      {cameraError && <p className="text-sm text-amber-700">No se pudo abrir la cámara (requiere HTTPS y permiso). Usa el código manual.</p>}
      <form onSubmit={(e) => { e.preventDefault(); submit(manual); setManual(""); }} className="flex gap-2">
        <input className="input font-mono uppercase" placeholder="Código manual" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn" disabled={busy}>Sumar</button>
      </form>
      {result && (
        <div role="status" className={`card ${result.ok ? "border-l-4 border-green-600" : "border-l-4 border-red-600"}`}>
          {result.ok ? (
            <>
              <p className="font-semibold">✓ Visita registrada: {result.customer}</p>
              {result.reward_ready
                ? <p className="mt-1 text-green-700">¡Completó {result.goal} visitas! Beneficio disponible.</p>
                : <p className="mt-1">Progreso: {result.progress}/{result.goal}</p>}
            </>
          ) : <p>{errors[result.error ?? "error_servidor"] ?? "No se pudo registrar."}{result.customer ? ` (${result.customer})` : ""}</p>}
        </div>
      )}
    </div>
  );
}
