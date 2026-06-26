import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { StatusBadge } from "@/components/admin/ui/status-badge"

export interface RelacionesCardProps {
  cliente: { id: string; nombre: string; tipoPersona: string } | null
  oportunidad: { id: string; nombre: string; etapa: string } | null
}

const DASH = "—"

/**
 * Card presentacional con las relaciones de la cotizacion: el cliente y la
 * oportunidad de origen. Cada fila enlaza a su ficha (cliente -> detalle 360,
 * oportunidad -> pipeline) y muestra un StatusBadge del estado relevante. Si la
 * relacion no existe muestra un em-dash. Sin hooks (puede ser server o client).
 */
export function RelacionesCard({ cliente, oportunidad }: RelacionesCardProps) {
  return (
    <div className="rounded-xl border border-border">
      {/* Cliente */}
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cliente
        </span>
        {cliente ? (
          <Link
            href={`/je-admin/clientes/${cliente.id}`}
            className="group flex min-w-0 items-center gap-2 text-right"
          >
            <span className="min-w-0 space-y-1">
              <span className="block truncate font-medium text-foreground underline-offset-4 group-hover:underline">
                {cliente.nombre}
              </span>
              <StatusBadge value={cliente.tipoPersona} withDot={false} />
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{DASH}</span>
        )}
      </div>

      {/* Oportunidad */}
      <div className="flex items-center justify-between gap-2 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Oportunidad
        </span>
        {oportunidad ? (
          <Link
            href="/je-admin/oportunidades"
            className="group flex min-w-0 items-center gap-2 text-right"
          >
            <span className="min-w-0 space-y-1">
              <span className="block truncate font-medium text-foreground underline-offset-4 group-hover:underline">
                {oportunidad.nombre}
              </span>
              <StatusBadge value={oportunidad.etapa} withDot={false} />
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{DASH}</span>
        )}
      </div>
    </div>
  )
}
