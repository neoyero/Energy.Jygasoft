import { cn } from "@/lib/utils"

export type ScoreBarSize = "sm" | "md"

export interface ScoreBarProps {
  /** Score del lead 0-100 (se clampa a ese rango). */
  score: number
  /** Tamano de la barra. "sm" para tarjetas kanban. Default "md". */
  size?: ScoreBarSize
  /** Oculta el numero a la derecha (util en espacios compactos). */
  hideValue?: boolean
  className?: string
}

/**
 * Tono por umbral de score: >=70 success (verde), >=40 warning (ambar),
 * resto neutral (stone). Coherente con la paleta de marca del panel.
 */
function toneClassForScore(score: number): string {
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400"
  if (score >= 40) return "bg-amber-500 dark:bg-amber-400"
  return "bg-stone-400 dark:bg-stone-500"
}

const TRACK_HEIGHT: Record<ScoreBarSize, string> = {
  sm: "h-1",
  md: "h-1.5",
}

/** Clampa un numero al rango [0, 100]; NaN/Infinity -> 0. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  if (score < 0) return 0
  if (score > 100) return 100
  return Math.round(score)
}

/**
 * Barra de score 0-100 con tono semantico por umbral. Componente puro: se usa
 * en la tabla de leads (columna ordenable) y en las tarjetas del kanban (mini).
 */
export function ScoreBar({
  score,
  size = "md",
  hideValue = false,
  className,
}: ScoreBarProps) {
  const value = clampScore(score)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "w-full min-w-12 overflow-hidden rounded-full bg-stone-200/80 dark:bg-muted",
          TRACK_HEIGHT[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Score ${value} de 100`}
      >
        <div
          className={cn("h-full rounded-full transition-all", toneClassForScore(value))}
          style={{ width: `${value}%` }}
        />
      </div>
      {hideValue ? null : (
        <span className="w-7 shrink-0 text-right text-xs tabular-nums text-stone-600 dark:text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  )
}
