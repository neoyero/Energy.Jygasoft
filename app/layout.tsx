import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { clientEnv } from "@/lib/env";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { ConsultChat } from "@/components/consult-chat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsultChat />
        <MetaPixel />
      </body>
    </html>
  );
}
