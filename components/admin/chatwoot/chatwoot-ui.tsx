"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** Resultado de una acción/consulta de Chatwoot (inferido de las server actions). */
export type Res<T> = { ok: true; data: T } | { ok: false; error: string }

export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

/** Carga un recurso de Chatwoot con estados de carga/error y recarga manual. */
export function useRecurso<T>(cargar: () => Promise<Res<T>>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)
  const recargar = useCallback(() => setToken((t) => t + 1), [])

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    cargar()
      .then((r) => {
        if (stale) return
        if (r.ok) setData(r.data)
        else setError(r.error)
        setLoading(false)
      })
      .catch(() => {
        if (stale) return
        setError("Error inesperado al consultar Chatwoot.")
        setLoading(false)
      })
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { data, loading, error, recargar }
}

export function AvisoError({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </div>
  )
}

/** Barra superior de una pestaña: recargar + (opcional) botón crear. */
export function BarraTab({
  onNuevo,
  onRecargar,
  puedeEditar,
  etiquetaNuevo,
}: {
  onNuevo?: () => void
  onRecargar: () => void
  puedeEditar: boolean
  etiquetaNuevo?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={onRecargar}>
        <RefreshCw className="size-4" aria-hidden /> Recargar
      </Button>
      {puedeEditar && onNuevo ? (
        <Button type="button" size="sm" onClick={onNuevo}>
          <Plus className="size-4" aria-hidden /> {etiquetaNuevo ?? "Nuevo"}
        </Button>
      ) : null}
    </div>
  )
}

/** Badge compacto con tono. */
export function badge(texto: string, tono: "green" | "gray" | "amber" | "blue" = "gray") {
  const clase =
    tono === "green"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : tono === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : tono === "blue"
          ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          : "bg-stone-100 text-stone-600 dark:bg-muted dark:text-muted-foreground"
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", clase)}>
      {texto}
    </span>
  )
}
