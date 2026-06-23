export interface ProcessStep {
  t: string;
  d: string;
}

/** Pasos numerados del proceso (timeline en rejilla). */
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((p, i) => (
        <li
          key={p.t}
          className="relative rounded-2xl border border-stone-200/70 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-brand-gold">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-4 font-bold text-brand">{p.t}</h3>
          <p className="mt-1.5 text-sm font-light leading-relaxed text-stone-600">{p.d}</p>
        </li>
      ))}
    </ol>
  );
}
