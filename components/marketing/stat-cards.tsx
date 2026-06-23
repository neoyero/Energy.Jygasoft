export interface Stat {
  v: string;
  l: string;
}

/** Tarjetas de métrica con número protagonista (3 o 4 columnas). */
export function StatCards({ items }: { items: Stat[] }) {
  const cols = items.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3";
  return (
    <div className={`grid gap-4 ${cols}`}>
      {items.map((m) => (
        <div
          key={m.l}
          className="rounded-2xl border border-stone-200/70 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
            {m.v}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-stone-500 sm:text-xs">
            {m.l}
          </p>
        </div>
      ))}
    </div>
  );
}
