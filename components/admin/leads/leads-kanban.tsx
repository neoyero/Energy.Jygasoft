"use client"

import { useMemo } from "react"
import Link from "next/link"

import { leadEstado } from "@/db/schema"
import type { LeadRow } from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { CanalIcon } from "@/components/admin/leads/canal-icon"
import { ScoreBar } from "@/components/admin/leads/score-bar"
import { cn } from "@/lib/utils"

const ESTADOS = leadEstado.enumValues

export interface LeadsKanbanProps {
  rows: ReadonlyArray<LeadRow>
}

/**
 * Vista kanban del listado de leads: una columna por estado (leadEstado), con
 * conteo en la cabecera. Cada tarjeta enlaza al detalle. Datos ya filtrados en
 * el contenedor (LeadsView); aqui solo se agrupan por estado.
 */
export function LeadsKanban({ rows }: LeadsKanbanProps) {
  // Agrupa filas por estado, preservando el orden recibido dentro de cada grupo.
  const porEstado = useMemo(() => {
    const map = new Map<string, LeadRow[]>()
    for (const estado of ESTADOS) map.set(estado, [])
    for (const row of rows) {
      const grupo = map.get(row.estado)
      if (grupo) grupo.push(row)
    }
    return map
  }, [rows])

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ESTADOS.map((estado) => {
        const items = porEstado.get(estado) ?? []
        return (
          <section key={estado} className="w-72 shrink-0">
            <header className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-medium text-stone-700 dark:text-foreground">
                {labelFor(estado)}
              </h2>
              <span className="text-xs tabular-nums text-stone-500 dark:text-muted-foreground">
                {items.length}
              </span>
            </header>

            <div className="space-y-2">
              {items.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/je-admin/leads/${lead.id}`}
                  className={cn(
                    "block rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-colors",
                    "hover:border-stone-300 hover:bg-stone-50",
                    "dark:border-border dark:bg-card dark:hover:bg-muted/40",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  )}
                >
                  <p className="font-medium text-stone-800 dark:text-foreground">
                    {lead.nombre ?? "Sin nombre"}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-muted-foreground">
                    {lead.telefono ?? lead.email ?? "—"}
                  </p>

                  {lead.canal ? (
                    <span className="mt-2 inline-flex items-center gap-1.5">
                      <CanalIcon canal={lead.canal} />
                      <StatusBadge value={lead.canal} size="sm" withDot={false} />
                    </span>
                  ) : null}

                  <div className="mt-2.5">
                    <ScoreBar score={lead.score} size="sm" />
                  </div>

                  <p className="mt-2 text-xs text-stone-500 dark:text-muted-foreground">
                    {lead.vendedorNombre ?? "Sin asignar"}
                  </p>
                </Link>
              ))}

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-200 p-3 text-center text-xs text-stone-400 dark:border-border dark:text-muted-foreground">
                  Vacio
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
