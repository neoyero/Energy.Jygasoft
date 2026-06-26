import type { EventoRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { EmptyState } from "@/components/admin/ui/empty-state"

export interface CotizacionHistorialProps {
  timeline: ReadonlyArray<EventoRow>
}

/**
 * Timeline (<ol>) del historial de una cotizacion. Cada evento muestra tipo,
 * descripcion opcional, actor y fecha relativa. EmptyState si no hay eventos.
 * Presentacional y sin hooks (server component).
 */
export function CotizacionHistorial({ timeline }: CotizacionHistorialProps) {
  if (timeline.length === 0) {
    return (
      <EmptyState
        title="Sin eventos"
        description="Aún no hay actividad registrada para esta cotización."
        size="sm"
      />
    )
  }

  return (
    <ol className="space-y-3">
      {timeline.map((e) => (
        <li key={String(e.id)} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{e.tipo}</span>
            <time className="text-xs text-muted-foreground">
              {fmtFechaRel(e.createdAt)}
            </time>
          </div>
          {e.descripcion ? (
            <p className="mt-1 text-sm text-muted-foreground">{e.descripcion}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">por {e.actor}</p>
        </li>
      ))}
    </ol>
  )
}
