import { BadgeCheck, FileCheck2, ShieldCheck, Zap } from "lucide-react";

export interface TrustItem {
  icon: React.ComponentType<{ className?: string }>;
  t: string;
}

const DEFAULT_ITEMS: TrustItem[] = [
  { icon: BadgeCheck, t: "Certificación CONOCER" },
  { icon: FileCheck2, t: "NOM-001-SEDE-2022" },
  { icon: ShieldCheck, t: "Garantía de 25 años" },
  { icon: Zap, t: "Trámite CFE incluido" },
];

/**
 * Franja de confianza sobrepuesta al hero (badges reales: certificaciones,
 * garantía, trámite). Pensada para colocarse justo después de un hero con
 * padding inferior amplio (usa margen negativo para solaparse).
 */
export function TrustBar({ items = DEFAULT_ITEMS }: { items?: TrustItem[] }) {
  return (
    <div className="relative z-20 mx-auto -mt-12 w-full max-w-7xl px-6 sm:px-10">
      <div className="grid grid-cols-2 gap-6 rounded-2xl border border-stone-200/70 bg-white px-8 py-6 shadow-xl md:grid-cols-4">
        {items.map((item) => (
          <div key={item.t} className="flex items-center gap-3">
            <item.icon className="h-5 w-5 shrink-0 text-brand-green" />
            <span className="text-sm font-semibold text-stone-700">{item.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
