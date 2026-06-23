import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

/**
 * Acordeón de preguntas frecuentes sin JavaScript (usa <details>/<summary>),
 * por lo que funciona como Server Component.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <details
          key={it.q}
          className="group rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-bold text-brand">
            {it.q}
            <ChevronDown className="h-5 w-5 shrink-0 text-brand-green transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 text-sm font-light leading-relaxed text-stone-600">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
