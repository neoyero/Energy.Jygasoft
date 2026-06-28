"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2 } from "lucide-react"

import { enlazarCotizacionConOportunidad } from "@/lib/admin/actions"
import type { OportunidadOpcion } from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Card, CardContent } from "@/components/admin/ui/card"

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"

export interface CotizacionOportunidadLinkProps {
  cotizacionId: string
  /** Oportunidad enlazada actualmente (o null). */
  oportunidadId: string | null
  /** Oportunidades del cliente para elegir. */
  opciones: ReadonlyArray<OportunidadOpcion>
  /** RBAC cotizaciones:edit. */
  puedeEditar: boolean
}

/**
 * Selector compacto para enlazar la cotización a una oportunidad del cliente. Al
 * enlazar, el total de la cotización se refleja en el monto de la oportunidad
 * (pipeline). Si el rol no puede editar, solo muestra el enlace actual.
 */
export function CotizacionOportunidadLink({
  cotizacionId,
  oportunidadId,
  opciones,
  puedeEditar,
}: CotizacionOportunidadLinkProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const actual = opciones.find((o) => o.id === oportunidadId) ?? null

  function cambiar(value: string): void {
    const nuevo = value === "" ? null : value
    if (nuevo === (oportunidadId ?? null)) return
    setError(null)
    startTransition(async () => {
      const res = await enlazarCotizacionConOportunidad(cotizacionId, nuevo)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Link2 className="size-4 text-muted-foreground" aria-hidden />
          Oportunidad enlazada
        </span>

        {puedeEditar && opciones.length > 0 ? (
          <select
            aria-label="Oportunidad enlazada"
            value={oportunidadId ?? ""}
            onChange={(e) => cambiar(e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin oportunidad</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} · {labelFor(o.etapa)}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {actual ? `${actual.nombre} · ${labelFor(actual.etapa)}` : "Sin oportunidad"}
          </span>
        )}

        <span className="text-xs text-muted-foreground">
          El total de la cotización se refleja como monto de la oportunidad en el
          pipeline.
        </span>

        {error ? (
          <span className="w-full text-sm text-destructive">{error}</span>
        ) : null}
      </CardContent>
    </Card>
  )
}
