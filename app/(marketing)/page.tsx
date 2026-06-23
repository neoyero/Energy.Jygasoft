import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  ShieldCheck,
  Zap,
  TrendingDown,
  Sun,
} from "lucide-react";
import { OrganizationJsonLd, LocalBusinessJsonLd } from "@/components/seo/json-ld";
import { HeroCarousel } from "@/components/hero-carousel";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const TRUST = [
  { icon: BadgeCheck, t: "Certificación CONOCER" },
  { icon: FileCheck2, t: "NOM-001-SEDE-2022" },
  { icon: ShieldCheck, t: "Garantía de 25 años" },
  { icon: Zap, t: "Trámite CFE incluido" },
];

const BENEFICIOS = [
  { icon: TrendingDown, t: "Hasta 99% de ahorro", d: "Reduce tu recibo de CFE, especialmente en tarifa DAC." },
  { icon: FileCheck2, t: "Trámite CFE incluido", d: "Gestionamos la interconexión completa hasta operación." },
  { icon: ShieldCheck, t: "Equipos con garantía", d: "Paneles TOPCon e inversores certificados UL1741 / IEEE1547." },
];

const PASOS = [
  { t: "Cálculo y propuesta", d: "Estimamos tu sistema con tu recibo y hacemos un levantamiento técnico." },
  { t: "Cotización", d: "Recibes inversión, ahorro estimado y payback, con equipos certificados." },
  { t: "Trámite CFE", d: "Solicitud de interconexión, estudio (si aplica) y oficio resolutivo." },
  { t: "Instalación", d: "Montaje de estructura, paneles e inversor por cuadrilla certificada." },
  { t: "Medidor y operación", d: "Instalación del medidor bidireccional y entrada en operación." },
  { t: "Monitoreo", d: "Seguimiento de generación y soporte postventa." },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <OrganizationJsonLd />
      <LocalBusinessJsonLd />

      {/* Hero carrusel */}
      <HeroCarousel />

      {/* Barra de confianza sobrepuesta */}
      <div className="relative z-20 mx-auto -mt-12 w-full max-w-7xl px-6 sm:px-10">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-stone-200/70 bg-white px-8 py-6 shadow-xl md:grid-cols-4">
          {TRUST.map((item) => (
            <div key={item.t} className="flex items-center gap-3">
              <item.icon className="h-5 w-5 shrink-0 text-brand-green" />
              <span className="text-sm font-semibold text-stone-700">{item.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Beneficios */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10">
        <div className="grid gap-6 sm:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div
              key={b.t}
              className="rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mint-light/40 text-brand-green">
                <b.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-brand">{b.t}</h2>
              <p className="mt-2 text-sm font-light leading-relaxed text-stone-600">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona (proceso) */}
      <section className="border-y border-stone-200 bg-brand-surface-2">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Proceso
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
              Cómo funciona
            </h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-stone-600">
              Te acompañamos de principio a fin: del primer cálculo hasta que tu
              sistema está generando y monitoreado.
            </p>
          </div>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PASOS.map((p, i) => (
              <li
                key={p.t}
                className="relative rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 font-bold text-brand">{p.t}</h3>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-stone-600">
                  {p.d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden bg-brand-green text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 py-14 sm:px-10 md:flex-row">
          <div className="flex items-center gap-4">
            <Sun className="hidden h-10 w-10 text-brand-gold sm:block" />
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Mira tu ahorro en menos de un minuto
              </h2>
              <p className="mt-1 text-sm font-light text-brand-mint-light">
                Solo necesitas tu recibo de CFE.
              </p>
            </div>
          </div>
          <Link
            href="/calculadora"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gold px-6 py-4 text-sm font-bold text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark"
          >
            Calcular ahora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
