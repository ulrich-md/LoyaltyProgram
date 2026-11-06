import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sello · momentos que regresan",
  description: "Programa de lealtad para negocios de México",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
