"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Building2 } from "lucide-react"

import type { OrganigramaNodo } from "@/lib/admin/queries"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

interface NodoArbol extends OrganigramaNodo {
  hijos: NodoArbol[]
}

export interface OrganigramaProps {
  nodos: ReadonlyArray<OrganigramaNodo>
}

/**
 * Organigrama (solo lectura): arma el árbol a partir de la línea de reporte
 * (reportaA) y lo renderiza con tarjetas anidadas y conectores. Las raíces son
 * los nodos sin jefe (o cuyo jefe no está en el conjunto). Colapsable por rama.
 */
export function Organigrama({ nodos }: OrganigramaProps) {
  const { raices, total } = useMemo(() => construirArbol(nodos), [nodos])

  if (total === 0) {
    return (
      <EmptyState
        title="Organigrama vacío"
        description="Asigna jefe y cargo a los usuarios (en Usuarios) para construir la estructura."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {raices.map((n) => (
        <NodoCard key={n.id} nodo={n} nivel={0} />
      ))}
    </div>
  )
}

/** Arma el bosque (puede haber varias raíces) desde la lista plana. */
function construirArbol(nodos: ReadonlyArray<OrganigramaNodo>): {
  raices: NodoArbol[]
  total: number
} {
  const mapa = new Map<string, NodoArbol>()
  for (const n of nodos) mapa.set(n.id, { ...n, hijos: [] })

  const raices: NodoArbol[] = []
  for (const n of mapa.values()) {
    const padre = n.reportaA ? mapa.get(n.reportaA) : null
    if (padre) padre.hijos.push(n)
    else raices.push(n) // sin jefe o jefe fuera del conjunto (inactivo)
  }

  // Orden estable: por nombre dentro de cada nivel.
  const ordenar = (lista: NodoArbol[]) => {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    lista.forEach((x) => ordenar(x.hijos))
  }
  ordenar(raices)

  return { raices, total: mapa.size }
}

function NodoCard({ nodo, nivel }: { nodo: NodoArbol; nivel: number }) {
  const [abierto, setAbierto] = useState(true)
  const tieneHijos = nodo.hijos.length > 0

  return (
    <div className={cn(nivel > 0 && "ml-5 border-l border-border pl-4")}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? "Colapsar" : "Expandir"}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block size-6 shrink-0" aria-hidden />
        )}

        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-muted dark:text-foreground">
          {nodo.nombre.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{nodo.nombre}</span>
            <StatusBadge value={nodo.rol} tone="neutral" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{nodo.cargo ?? labelFor(nodo.rol)}</span>
            {nodo.areaNombre ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" aria-hidden /> {nodo.areaNombre}
              </span>
            ) : null}
            {tieneHijos ? (
              <span>
                {nodo.hijos.length} a cargo
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {tieneHijos && abierto ? (
        <div className="mt-2 flex flex-col gap-2">
          {nodo.hijos.map((h) => (
            <NodoCard key={h.id} nodo={h} nivel={nivel + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
