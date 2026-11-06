import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { logout } from "./actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  if (s.role === "platform") redirect("/plataforma");
  const b = s.business!;
  return (
    <div style={{ ["--brand" as string]: b.brand_primary }}>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 p-4">
          <strong style={{ color: b.brand_primary }}>{b.name}</strong>
          <nav className="flex gap-4 text-sm">
            <Link href="/panel">Escanear</Link><Link href="/panel/clientes">Clientas</Link>
            {s.role === "admin" && <Link href="/panel/ajustes">Ajustes</Link>}
          </nav>
          <form action={logout}><button className="text-sm underline">Salir</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
