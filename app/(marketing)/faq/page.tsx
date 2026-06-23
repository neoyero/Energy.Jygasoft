import type { Metadata } from "next";
import { faqs } from "#site/content";
import { FaqJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre energía solar",
  description:
    "Costos, ahorro, trámite CFE y garantías de los sistemas solares en Aguascalientes. Resolvemos tus dudas.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const items = [...faqs].sort((a, b) => a.orden - b.orden);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <FaqJsonLd items={items.map((f) => ({ pregunta: f.pregunta, respuesta: f.plain }))} />
      <span className="text-xs font-bold uppercase tracking-widest text-brand-green">
        Dudas comunes
      </span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-brand">Preguntas frecuentes</h1>
      <dl className="mt-8 divide-y divide-stone-200">
        {items.map((f) => (
          <div key={f.slug} className="py-6">
            <dt className="text-lg font-medium">{f.pregunta}</dt>
            <dd
              className="prose prose-neutral mt-2 max-w-none text-muted-foreground dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: f.html }}
            />
          </div>
        ))}
      </dl>
    </main>
  );
}
