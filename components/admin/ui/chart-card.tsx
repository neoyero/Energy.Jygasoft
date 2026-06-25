"use client"

import type { ReactNode } from "react"
import { BarChart3 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"

export interface ChartLegendItem {
  label: string
  /** Color del swatch (token hsl/hex de marca). */
  color: string
}

export interface ChartCardProps {
  /** Titulo de la grafica. */
  title: ReactNode
  /** Subtitulo/descripcion opcional. */
  description?: ReactNode
  /** Acciones (rango de fechas, filtros). */
  actions?: ReactNode
  /** Leyenda manual opcional bajo el header. */
  legend?: ReadonlyArray<ChartLegendItem>
  /** Alto del area de grafica en px. Default 280. */
  height?: number
  /** Estado de carga -> skeleton del area. Default false. */
  loading?: boolean
  /** Marca de sin-datos -> EmptyState dentro del area. Default false. */
  isEmpty?: boolean
  /** Config del estado vacio (titulo/icono). */
  empty?: { title: ReactNode; description?: ReactNode }
  /**
   * La grafica: tipicamente un wrapper de charts.tsx que YA incluye su propio
   * ResponsiveContainer, o children libres de recharts.
   */
  children: ReactNode
  className?: string
}

/** Alto por defecto del area de grafica (px). */
const DEFAULT_HEIGHT = 280

/** Titulo por defecto del estado vacio. */
const DEFAULT_EMPTY_TITLE = "Sin datos para mostrar"

/**
 * Leyenda manual bajo el header: fila de swatches de color + etiqueta.
 * El color del swatch se aplica inline (token de marca arbitrario).
 */
function ChartLegend({ items }: { items: ReadonlyArray<ChartLegendItem> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/**
 * ChartCard: wrapper estandar de las graficas del panel (Dashboard y Metricas).
 * Unifica alto, spacing, header con acciones, leyenda opcional y los estados
 * loading/empty. Client component porque envuelve graficas recharts (que
 * requieren cliente) y maneja estado visual.
 */
export function ChartCard({
  title,
  description,
  actions,
  legend,
  height = DEFAULT_HEIGHT,
  loading = false,
  isEmpty = false,
  empty,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card padding="md" className={className}>
      <CardHeader action={actions}>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>

      {/* Leyenda manual opcional (solo si hay datos visibles). */}
      {legend && legend.length > 0 && !loading && !isEmpty ? (
        <ChartLegend items={legend} />
      ) : null}

      {/* Area de grafica de alto fijo: skeleton, estado vacio o la grafica. */}
      <div className="mt-4 w-full" style={{ height }}>
        {loading ? (
          <div
            className="size-full animate-pulse rounded-xl bg-stone-100 dark:bg-muted"
            aria-hidden="true"
          />
        ) : isEmpty ? (
          <div className="grid size-full place-items-center">
            <EmptyState
              size="sm"
              icon={BarChart3}
              title={empty?.title ?? DEFAULT_EMPTY_TITLE}
              description={empty?.description}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  )
}
