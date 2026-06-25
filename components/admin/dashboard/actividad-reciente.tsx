import type { EventoRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { cn } from "@/lib/utils"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"

/**
 * Timeline de actividad reciente del panel. Server component puro (sin hooks):
 * recibe los eventos ya resueltos por la pagina RSC y los pinta como una lista
 * vertical con punto/linea de color, tipo (StatusBadge), descripcion, actor y
 * la fecha relativa alineada a la derecha.
 */
export function ActividadReciente({ rows }: { rows: EventoRow[] }) {
  if (rows.length === 0) {
    return (
      <Card padding="none" className="overflow-hidden">
        <EmptyState
          size="sm"
          title="Sin actividad reciente"
          description="Aqui apareceran los ultimos eventos del panel."
        />
      </Card>
    )
  }

  return (
    <Card>
      <ol className="relative flex flex-col">
        {rows.map((evento, index) => {
          const isLast = index === rows.length - 1
          return (
            <li key={evento.id} className="flex gap-3">
              {/* Carril: punto + linea conectora (excepto el ultimo item). */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand ring-4 ring-brand/10 dark:bg-primary dark:ring-primary/15"
                  aria-hidden
                />
                {!isLast ? (
                  <span
                    className="mt-1 w-px grow bg-stone-200 dark:bg-border"
                    aria-hidden
                  />
                ) : null}
              </div>

              {/* Contenido del evento. */}
              <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-5")}>
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge value={evento.tipo} />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {fmtFechaRel(evento.createdAt)}
                  </span>
                </div>

                {evento.descripcion ? (
                  <p className="mt-1.5 text-sm text-stone-700 dark:text-foreground">
                    {evento.descripcion}
                  </p>
                ) : null}

                <p className="mt-1 text-xs text-muted-foreground">
                  {evento.actor}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
