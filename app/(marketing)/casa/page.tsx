import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  TrendingDown,
  Ruler,
  FileCheck2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { TrustBar } from "@/components/marketing/trust-bar";
import { BenefitGrid, type Benefit } from "@/components/marketing/benefit-grid";
import { StatCards, type Stat } from "@/components/marketing/stat-cards";
import { ProcessSteps, type ProcessStep } from "@/components/marketing/process-steps";
import { FaqList, type FaqItem } from "@/components/marketing/faq-list";

export const metadata: Metadata = {
  title: "Paneles solares para casa en Aguascalientes",
  description:
    "Sistemas solares residenciales en Aguascalientes. Sal de la tarifa DAC, reduce tu recibo CFE hasta 95% y recupera tu inversión en ~3 años. Trámite CFE incluido.",
  alternates: { canonical: "/casa" },
};

const BENEFICIOS: Benefit[] = [
  { icon: TrendingDown, t: "Sal de la tarifa DAC", d: "Reduce tu consumo neto y recupera tu tarifa subsidiada." },
  { icon: Ruler, t: "Dimensionado a tu consumo", d: "Calculamos los kWp y paneles ideales para tu autoconsumo." },
  { icon: FileCheck2, t: "Trámite CFE incluido", d: "Gestionamos la interconexión completa, hasta dejarlo en operación." },
  { icon: ShieldCheck, t: "Garantía de 25 años", d: "Paneles TOPCon e inversores certificados UL1741 / IEEE1547." },
];

const STATS: Stat[] = [
  { v: "3–6 kWp", l: "Sistema típico" },
  { v: "6–12", l: "Paneles" },
  { v: "~3 años", l: "Retorno" },
  { v: "70–95%", l: "Menos recibo" },
];

const PASOS: ProcessStep[] = [
  { t: "Cálculo y propuesta", d: "Estimamos tu sistema con tu recibo y hacemos un levantamiento técnico." },
  { t: "Cotización", d: "Recibes inversión, ahorro estimado y payback, con equipos certificados." },
  { t: "Trámite CFE", d: "Solicitud de interconexión, estudio (si aplica) y oficio resolutivo." },
  { t: "Instalación", d: "Montaje de estructura, paneles e inversor por cuadrilla certificada." },
  { t: "Medidor y operación", d: "Instalación del medidor bidireccional y entrada en operación." },
  { t: "Monitoreo", d: "Seguimiento de generación y soporte postventa desde tu celular." },
];

const FAQS: FaqItem[] = [
  {
    q: "¿Cuánto cuesta un sistema solar para casa?",
    a: (
      <>
        Depende de tu consumo. En Aguascalientes la inversión ronda{" "}
        <strong>$14,000–$17,500 MXN por kWp</strong>. Con tu recibo, la{" "}
        <Link href="/calculadora" className="text-brand-green underline">
          calculadora
        </Link>{" "}
        te da un rango al instante.
      </>
    ),
  },
  {
    q: "¿Cuánto voy a ahorrar?",
    a: (
      <>
        Entre <strong>70% y 95%</strong> de tu facturación, según tu tarifa y consumo. Los
        clientes en <strong>DAC</strong> son quienes más ahorran. Los excedentes se liquidan a
        PML (menor a la tarifa), por eso conviene dimensionar para autoconsumo.
      </>
    ),
  },
  {
    q: "¿Ustedes hacen el trámite con CFE?",
    a: (
      <>
        Sí. Gestionamos la interconexión completa: solicitud, estudio (si aplica), oficio
        resolutivo, contratos y medidor bidireccional, hasta dejar tu sistema{" "}
        <strong>en operación</strong>.
      </>
    ),
  },
];

export default function CasaPage() {
  return (
    <main>
      {/* Hero con imagen */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-28 pt-20 sm:px-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
              Residencial
            </span>
            <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Paneles solares para tu casa
            </h1>
            <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-brand-mint">
              Si tu recibo no para de subir —o ya caíste en tarifa DAC— un sistema solar
              residencial puede bajarlo hasta un 95%. Nosotros hacemos el trámite CFE y la
              instalación.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/calculadora"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-4 text-sm font-bold text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark"
              >
                Calcular mi ahorro <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                Hablar con un asesor
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
              <Image
                src="/hero-residencial.png"
                alt="Casa con paneles solares en Aguascalientes"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      {/* Beneficios */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-16 pt-24 sm:px-12">
        <div className="mb-12 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Por qué conviene
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            Más ahorro, menos trámites para ti
          </h2>
        </div>
        <BenefitGrid items={BENEFICIOS} />
      </section>

      {/* La trampa de la tarifa DAC */}
      <section className="border-y border-stone-200 bg-brand-surface-2">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-20 sm:px-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Tarifa DAC
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
              ¿Tu recibo se disparó? Quizá caíste en DAC
            </h2>
            <p className="mt-4 text-base font-light leading-relaxed text-stone-600">
              En Aguascalientes el aire acondicionado en verano dispara el consumo. Cuando tu
              promedio supera el límite, CFE te quita el subsidio y pasas a la{" "}
              <strong className="font-semibold text-brand">tarifa DAC</strong>: cada kWh
              cuesta varias veces más.
            </p>
            <p className="mt-3 text-base font-light leading-relaxed text-stone-600">
              Un sistema solar baja tu consumo neto registrado por CFE y, en pocos meses, te
              regresa a tarifa subsidiada —además de recortar el recibo todos los meses.
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Costo por kWh (referencia CFE)
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-stone-700">Tarifa básica</span>
                  <span className="text-2xl font-extrabold text-brand-green">~$1.13</span>
                </div>
                <div className="mt-2 h-2 w-1/5 rounded-full bg-brand-green" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-stone-700">Tarifa DAC</span>
                  <span className="text-2xl font-extrabold text-brand-gold-dark">~$6.75</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-brand-gold" />
              </div>
            </div>
            <p className="mt-6 text-xs font-light leading-relaxed text-stone-500">
              Cifras de referencia CFE para Aguascalientes; varían por periodo y región.
            </p>
          </div>
        </div>
      </section>

      {/* Qué esperar */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-12">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Qué esperar
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            Un sistema residencial típico
          </h2>
        </div>
        <StatCards items={STATS} />
        <p className="mt-6 text-xs text-stone-500">
          Cifras ilustrativas; el dimensionamiento y el retorno dependen de tu consumo,
          tarifa y esquema de interconexión. Estima el tuyo en la{" "}
          <Link href="/calculadora" className="text-brand-green underline">
            calculadora
          </Link>
          .
        </p>
      </section>

      {/* Cómo funciona */}
      <section className="border-y border-stone-200 bg-brand-surface-2">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-12">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Proceso
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
              Cómo funciona, paso a paso
            </h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-stone-600">
              Te acompañamos de principio a fin: del primer cálculo hasta que tu sistema está
              generando y monitoreado.
            </p>
          </div>
          <ProcessSteps steps={PASOS} />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-12">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Preguntas frecuentes
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
            Lo que más nos preguntan
          </h2>
        </div>
        <FaqList items={FAQS} />
        <p className="mt-6 text-sm font-light text-stone-600">
          ¿Más dudas? Revisa{" "}
          <Link href="/faq" className="font-semibold text-brand-green underline">
            todas las preguntas
          </Link>{" "}
          o escríbenos en{" "}
          <Link href="/soporte" className="font-semibold text-brand-green underline">
            Soporte
          </Link>
          .
        </p>
      </section>

      {/* CTA final */}
      <section className="bg-brand-green">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 text-white sm:px-12 md:flex-row">
          <div className="flex items-center gap-4">
            <Sun className="hidden h-9 w-9 text-brand-gold sm:block" />
            <h2 className="text-xl font-extrabold tracking-tight">
              ¿Listo para dejar de pagarle de más a CFE?
            </h2>
          </div>
          <Link
            href="/calculadora"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gold px-6 py-3.5 text-sm font-bold text-brand-ink transition-all hover:bg-brand-gold-dark"
          >
            Calcular ahora <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
