import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  Factory,
  FileSearch,
  TrendingDown,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { TrustBar } from "@/components/marketing/trust-bar";
import { BenefitGrid, type Benefit } from "@/components/marketing/benefit-grid";
import { StatCards, type Stat } from "@/components/marketing/stat-cards";
import { ProcessSteps, type ProcessStep } from "@/components/marketing/process-steps";
import { FaqList, type FaqItem } from "@/components/marketing/faq-list";

export const metadata: Metadata = {
  title: "Energía solar para negocios e industria en Aguascalientes",
  description:
    "Soluciones solares comerciales e industriales (PDBT, GDMT) en Aguascalientes. Estabiliza tu costo eléctrico, mejora tu rentabilidad y gestiona el trámite CFE con nosotros.",
  alternates: { canonical: "/negocio" },
};

const BENEFICIOS: Benefit[] = [
  { icon: Factory, t: "PDBT / GDMT", d: "Proyectos en baja y media tensión según tu tarifa." },
  { icon: FileSearch, t: "Estudio de media tensión", d: "Gestionamos el estudio y el oficio resolutivo cuando aplica." },
  { icon: TrendingDown, t: "Retorno claro", d: "Cotización con inversión, ahorro y payback estimado." },
  { icon: ShieldCheck, t: "Garantía y postventa", d: "Equipos certificados, monitoreo y mantenimiento." },
];

const STATS: Stat[] = [
  { v: "10–100+ kWp", l: "Escala del sistema" },
  { v: "PDBT / GDMT", l: "Tarifas" },
  { v: "~3–5 años", l: "Retorno" },
  { v: "25 años", l: "Garantía" },
];

const PASOS: ProcessStep[] = [
  { t: "Diagnóstico y levantamiento", d: "Analizamos tu consumo, tarifa y espacio disponible (azotea o piso)." },
  { t: "Propuesta técnica y económica", d: "Inversión, ahorro y payback con equipos certificados." },
  { t: "Estudio de media tensión", d: "Cuando aplica (GDMT), gestionamos el estudio y el oficio resolutivo." },
  { t: "Trámite CFE", d: "Solicitud de interconexión, contratos y medidor bidireccional." },
  { t: "Instalación", d: "Montaje por cuadrilla certificada, con mínima interrupción de tu operación." },
  { t: "Monitoreo y mantenimiento", d: "Seguimiento de generación y soporte postventa." },
];

const FAQS: FaqItem[] = [
  {
    q: "¿Cuánto cuesta un sistema para mi negocio?",
    a: (
      <>
        Depende de tu consumo y tarifa. La inversión ronda{" "}
        <strong>$14,000–$17,500 MXN por kWp</strong> y se ajusta a la escala del proyecto.
        Solicita una{" "}
        <Link href="/contacto" className="text-brand-green underline">
          cotización
        </Link>{" "}
        a tu medida.
      </>
    ),
  },
  {
    q: "¿Necesito estudio de media tensión?",
    a: (
      <>
        Si estás en <strong>media tensión (GDMTO / GDMTH)</strong>, normalmente CFE requiere un
        estudio antes de la interconexión. Nosotros lo gestionamos junto con el oficio
        resolutivo cuando aplica.
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

export default function NegocioPage() {
  return (
    <main>
      {/* Hero con imagen */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-green/25 blur-3xl" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-28 pt-20 sm:px-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
              Comercial / Industrial
            </span>
            <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Energía solar para tu negocio
            </h1>
            <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-brand-mint">
              La energía es uno de tus mayores costos operativos. Un sistema solar comercial
              o industrial estabiliza tu gasto eléctrico y mejora tu rentabilidad, con
              equipos certificados y trámite CFE gestionado.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contacto"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-4 text-sm font-bold text-brand-ink shadow-md transition-all hover:bg-brand-gold-dark"
              >
                Solicitar cotización <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/calculadora"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                Estimar ahorro
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
              <Image
                src="/hero-comercial.png"
                alt="Nave comercial con paneles solares"
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
            Un costo eléctrico bajo control
          </h2>
        </div>
        <BenefitGrid items={BENEFICIOS} />
      </section>

      {/* Energía como costo controlable */}
      <section className="border-y border-stone-200 bg-brand-surface-2">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-20 sm:px-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
              Rentabilidad
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
              Convierte un gasto variable en una inversión que se paga sola
            </h2>
            <p className="mt-4 text-base font-light leading-relaxed text-stone-600">
              La tarifa eléctrica sube cada año y golpea tu margen. Generar tu propia energía
              fija una buena parte de ese costo por más de 25 años y blinda tu operación
              frente a futuros aumentos.
            </p>
            <p className="mt-3 text-base font-light leading-relaxed text-stone-600">
              Dimensionamos el sistema a tu consumo real para maximizar el autoconsumo, donde
              está el mayor ahorro.
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
              Según tu tarifa
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-bold text-brand">PDBT</dt>
                <dd className="font-light text-stone-600">
                  Comercios y oficinas en baja tensión: instalación en azotea dimensionada al
                  consumo del negocio.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-brand">GDMTO / GDMTH</dt>
                <dd className="font-light text-stone-600">
                  Media tensión: proyectos de mayor escala con estudio y oficio resolutivo
                  gestionados por nosotros.
                </dd>
              </div>
            </dl>
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
            Proyectos a la medida de tu operación
          </h2>
        </div>
        <StatCards items={STATS} />
        <p className="mt-6 text-xs text-stone-500">
          Cifras ilustrativas; la escala y el retorno dependen de tu consumo, tarifa y esquema
          de interconexión.
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
              Del diagnóstico a la operación
            </h2>
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
              Optimiza el costo energético de tu empresa
            </h2>
          </div>
          <Link
            href="/contacto"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gold px-6 py-3.5 text-sm font-bold text-brand-ink transition-all hover:bg-brand-gold-dark"
          >
            Solicitar cotización <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
