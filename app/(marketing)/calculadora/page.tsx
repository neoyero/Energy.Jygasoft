import type { Metadata } from "next";
import { CalcForm } from "@/components/forms/calc-form";

export const metadata: Metadata = {
  title: "Calculadora de ahorro solar",
  description:
    "Calcula cuántos paneles necesitas, tu inversión estimada y tu ahorro con energía solar en Aguascalientes. Resultado al instante.",
  alternates: { canonical: "/calculadora" },
};

export default function CalculadoraPage() {
  return (
    <main className="bg-brand-surface-2">
      <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-12">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
            Retorno de inversión
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand">
            Simulador de ahorro solar
          </h1>
          <p className="mt-4 text-lg font-light leading-relaxed text-stone-600">
            Descubre cuántos paneles necesita tu propiedad, el costo aproximado del
            sistema y en cuánto recuperas tu inversión. Sin compromiso.
          </p>
        </div>
        <CalcForm />
      </div>
    </main>
  );
}
