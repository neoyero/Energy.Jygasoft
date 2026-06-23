export interface Benefit {
  icon: React.ComponentType<{ className?: string }>;
  t: string;
  d: string;
}

/** Rejilla de tarjetas de beneficio. 3 o 4 columnas según la cantidad. */
export function BenefitGrid({ items }: { items: Benefit[] }) {
  const cols =
    items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div className={`grid gap-6 ${cols}`}>
      {items.map((b) => (
        <div
          key={b.t}
          className="rounded-2xl border border-stone-200/70 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mint-light/40 text-brand-green">
            <b.icon className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-lg font-bold text-brand">{b.t}</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-stone-600">{b.d}</p>
        </div>
      ))}
    </div>
  );
}
