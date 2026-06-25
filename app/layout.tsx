import type { Metadata } from "next";
// Fuente auto-hospedada (paquete `geist`): NO descarga de Google Fonts, así que
// no depende del proxy/CA corporativo en dev y es más rápida/segura en prod.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { clientEnv } from "@/lib/env";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { ConsultChat } from "@/components/consult-chat";

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Jygasoft Energy — Energía solar en Aguascalientes",
    template: "%s · Jygasoft Energy",
  },
  description:
    "Paneles solares para casa y negocio en Aguascalientes. Cotiza tu ahorro, trámite CFE e instalación con Jygasoft Energy.",
  applicationName: "Jygasoft Energy",
  formatDetection: { telephone: true, email: true, address: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-MX"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsultChat />
        <MetaPixel />
      </body>
    </html>
  );
}
