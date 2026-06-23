import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { UseCases } from "@/components/use-cases";

export const metadata: Metadata = {
  title: "Casos de uso de energía solar por perfil",
  description:
    "Soluciones de energía solar para cada perfil: residencial, granjas y agro, negocios pequeños e industria. Reto, solución y resultado de cada caso.",
  alternates: { canonical: "/casos-uso" },
};

export default function CasosUsoPage() {
  return (
    <main>
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: "Casos de uso", path: "/casos-uso" },
        ]}
      />

      {/* Encabezado */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-green/25 blur-3xl" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16 sm:px-10">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-mint">
            Casos de uso
          </span>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Una solución para cada tipo de proyecto
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-brand-mint">
            Así trabajamos según tu perfil: del hogar a la industria. Cada proyecto se
            dimensiona a tu consumo real.
          </p>
        </div>
      </section>

      <UseCases showHeader={false} />
    </main>
  );
}
