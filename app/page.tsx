import Link from "next/link";
export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6 pt-20 text-center">
      <h1 className="text-3xl font-bold">TUQO Lealtad</h1>
      <p className="mt-3 text-neutral-600">Tarjeta de cliente frecuente digital para tu negocio.</p>
      <Link href="/login" className="btn mt-8">Acceso del personal</Link>
    </main>
  );
}
