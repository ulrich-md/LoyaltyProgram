import { requireStaff } from "@/lib/auth";
import { Scanner } from "@/components/Scanner";

export default async function Panel() {
  const s = await requireStaff(["admin", "staff"]);
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Registrar visita</h1>
      <p className="mb-4 text-sm text-neutral-600">Servicio elegible: {s.business!.eligible_service}. Escanea el QR de la tarjeta de la clienta.</p>
      <Scanner />
    </>
  );
}
