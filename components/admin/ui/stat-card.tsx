import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/admin/ui/card";

export type TrendDirection = "up" | "down" | "flat";

export interface StatTrend {
  /** Texto a mostrar, ej. "+12.5%" o "+3". */
  value: string;
  /** Direccion -> color e icono (up=success, down=danger, flat=neutral). */
  direction: TrendDirection;
  /** Etiqueta contextual opcional, ej. "vs mes anterior". */
  label?: string;
  /**
   * Invierte la semantica de color (cuando "down" es bueno, p.ej. CPL o
   * cuentas vencidas). Default false.
   */
  goodWhenDown?: boolean;
}

export interface StatCardProps {
  /** Etiqueta del KPI, ej. "Leads nuevos". */
  label: string;
  /** Valor protagonista ya formateado (moneda, %, conteo). */
  value: ReactNode;
  /** Icono lucide (se pasa el componente, no el elemento). */
  icon?: ComponentType<LucideProps>;
  /** Sub-texto neutro bajo el valor (alternativa simple a trend). */
  sub?: ReactNode;
  /** Tendencia con delta y direccion coloreada. Tiene prioridad sobre sub. */
  trend?: StatTrend;
  /** Slot para grafica mini (ej. <Sparkline data={...} />). */
  sparkline?: ReactNode;
  /** Tono del chip del icono. Default "brand". */
  accent?: "brand" | "green" | "gold" | "mint" | "neutral";
  /** Convierte toda la tarjeta en enlace (drill-down al modulo). */
  href?: string;
  /** Estado de carga -> skeleton. Default false. */
  loading?: boolean;
  className?: string;
}

/** Mapa de tonos del chip del icono segun la marca. */
const ACCENT_CHIP: Record<NonNullable<StatCardProps["accent"]>, string> = {
  brand: "bg-brand/10 text-brand",
  green: "bg-brand-green/10 text-brand-green",
  gold: "bg-brand-gold/15 text-brand-gold-dark",
  mint: "bg-brand-mint/30 text-brand-green-dark",
  neutral: "bg-muted text-muted-foreground",
};

/** Estilos por direccion de tendencia (color + chip). */
const TREND_STYLE: Record<TrendDirection, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
  flat: "text-stone-500 bg-stone-100",
};

/** Icono lucide por direccion de tendencia. */
const TREND_ICON: Record<TrendDirection, ComponentType<LucideProps>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

/**
 * Resuelve el estilo de color de la tendencia aplicando `goodWhenDown`:
 * cuando "bajar es bueno" intercambia la semantica de up/down.
 */
function resolveTrendStyle(trend: StatTrend): string {
  if (trend.direction === "flat" || !trend.goodWhenDown) {
    return TREND_STYLE[trend.direction];
  }
  // Semantica invertida: up usa rojo, down usa verde.
  return trend.direction === "up" ? TREND_STYLE.down : TREND_STYLE.up;
}

/** Pildora de tendencia con icono + delta y etiqueta contextual opcional. */
function TrendBadge({ trend }: { trend: StatTrend }) {
  const Icon = TREND_ICON[trend.direction];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
          resolveTrendStyle(trend),
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {trend.value}
      </span>
      {trend.label ? (
        <span className="text-xs text-stone-500 dark:text-muted-foreground">
          {trend.label}
        </span>
      ) : null}
    </div>
  );
}

/** Skeleton de carga coherente con la estructura de la tarjeta. */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card padding="md" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
          <div className="h-8 w-20 animate-pulse rounded bg-stone-100" />
          <div className="h-3 w-28 animate-pulse rounded bg-stone-100" />
        </div>
        <div className="size-9 animate-pulse rounded-xl bg-stone-100" />
      </div>
    </Card>
  );
}

/**
 * Tarjeta KPI del panel: chip de icono, label en mayusculas, valor grande
 * tabular, tendencia/sub-texto opcional y franja inferior para sparkline.
 * Server component (next/link funciona en RSC cuando se pasa `href`).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  trend,
  sparkline,
  accent = "brand",
  href,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton className={className} />;
  }

  const content = (
    <Card
      padding="md"
      className={cn(
        // Interactividad sutil solo cuando es enlace (drill-down).
        href &&
          "transition-colors hover:border-brand/30 hover:bg-brand-surface",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-stone-500 dark:text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-brand tabular-nums dark:text-foreground sm:text-3xl">
            {value}
          </p>

          {/* La tendencia tiene prioridad sobre el sub-texto neutro. */}
          {trend ? (
            <TrendBadge trend={trend} />
          ) : sub ? (
            <p className="mt-1 text-sm text-stone-500 dark:text-muted-foreground">
              {sub}
            </p>
          ) : null}
        </div>

        {Icon ? (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              ACCENT_CHIP[accent],
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {/* Franja inferior para la grafica mini (ej. <Sparkline />). */}
      {sparkline ? <div className="-mx-1 mt-3 h-10">{sparkline}</div> : null}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}
