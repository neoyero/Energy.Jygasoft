"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { crearCotizacion } from "@/lib/admin/actions"
import type {
  ClienteCotizacionRow,
  ClienteOportunidadRow,
} from "@/lib/admin/queries"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

const DASH = "—"

export interface CotizacionesPanelProps {
  clienteId: string
  cotizaciones: ReadonlyArray<ClienteCotizacionRow>
  /** Oportunidades del cliente para enlazar opcionalmente al crear. */
  oportunidades: ReadonlyArray<ClienteOportunidadRow>
  /** RBAC cotizaciones:edit -> habilita el alta de borradores. */
  puedeCrear: boolean
}

/**
 * Panel de cotizaciones de un cliente. Lista las cotizaciones (folio, version,
 * estado, total y vigencia) con filas clicables al detalle. Si el rol puede
 * crear, ofrece un boton "Nueva cotizacion" que crea un borrador via server
 * action (opcionalmente enlazado a una oportunidad) y navega a su builder.
 */
export function CotizacionesPanel({
  clienteId,
  cotizaciones,
  oportunidades,
  puedeCrear,
}: CotizacionesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // "" = sin oportunidad; o id de la oportunidad a enlazar.
  const [oportunidadId, setOportunidadId] = useState<string>("")

  function crear(): void {
    setError(null)
    startTransition(async () => {
      const res = await crearCotizacion({
        clienteId,
        oportunidadId: oportunidadId || null,
      })

      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.id) {
        router.push(`/je-admin/cotizaciones/${res.id}`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeCrear ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {cotizaciones.length} cotizaci{cotizaciones.length === 1 ? "ón" : "ones"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {oportunidades.length > 0 ? (
              <select
                aria-label="Enlazar a oportunidad"
                value={oportunidadId}
                onChange={(e) => setOportunidadId(e.target.value)}
                disabled={pending}
                className={cn(
                  "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="">Sin oportunidad</option>
                {oportunidades.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="button" size="sm" disabled={pending} onClick={crear}>
              <Plus className="size-4" aria-hidden />
              {pending ? "Creando…" : "Nueva cotización"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {cotizaciones.length === 0 ? (
        <EmptyState
          title="Sin cotizaciones"
          description="Este cliente no tiene cotizaciones registradas."
          size="sm"
        />
      ) : (
        <SimpleTable head={["Folio", "Versión", "Estado", "Total", "Vigencia"]}>
          {cotizaciones.map((c) => (
            <Row
              key={c.id}
              href={`/je-admin/cotizaciones/${c.id}`}
              cells={[
                <span key="folio" className="font-medium text-foreground">
                  {c.folio ?? DASH}
                </span>,
                `v${c.version}`,
                <StatusBadge key="estado" value={c.estado} withDot={false} />,
                formatMXN(c.total),
                fmtFechaRel(c.validaHasta),
              ]}
            />
          ))}
        </SimpleTable>
      )}
    </div>
  )
}

/** Tabla simple presentacional con cabecera de columnas. */
function SimpleTable({
  head,
  children,
}: {
  head: ReadonlyArray<string>
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-border bg-muted/40 text-left">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Fila clicable: navega al href interno via router. */
function Row({
  href,
  cells,
}: {
  href: string
  cells: ReadonlyArray<React.ReactNode>
}) {
  const router = useRouter()

  function navegar(): void {
    router.push(href)
  }

  return (
    <tr
      onClick={navegar}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          navegar()
        }
      }}
      tabIndex={0}
      className={cn(
        "border-b border-border last:border-0 cursor-pointer transition-colors",
        "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      )}
    >
      {cells.map((cell, i) => (
        <td key={i} className="px-4 py-3 text-stone-700 dark:text-foreground">
          {cell}
        </td>
      ))}
    </tr>
  )
}
