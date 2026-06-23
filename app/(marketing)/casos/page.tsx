import type { Metadata } from "next";
import Link from "next/link";
import { casos } from "#site/content";

export const metadata: Metadata = {
  title: "Casos de éxito en energía solar",
  description:
    "Proyectos solares reales en Aguascalientes: ahorro logrado, capacidad instalada y resultados de nuestros clientes.",
  alternates: { canonical: "/casos" },
};

export default function CasosIndex() {
  const items = [...casos].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
        Resultados reales
      </span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand">Casos de éxito</h1>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {items.map((c) => (
          <Link
            key={c.slug}
            href={c.url}
            className="rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-bold text-brand">{c.title}</h2>
            <p className="mt-2 text-sm font-light text-stone-600">{c.description}</p>
            <div className="mt-3 flex gap-4 text-xs font-semibold text-brand-green">
              {c.capacidadKwp && <span>{c.capacidadKwp} kWp</span>}
              {c.ahorroPct && <span>{c.ahorroPct}% ahorro</span>}
              {c.municipio && <span>{c.municipio}</span>}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
