"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { leadEstado } from "@/db/schema"
import type { FetchLeadsFiltros, LeadRow } from "@/lib/admin/queries"
import { fetchLeads } from "@/lib/admin/actions"
import { labelFor } from "@/components/admin/ui/status-badge"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Card } from "@/components/admin/ui/card"
import { CanalIcon } from "@/components/admin/leads/canal-icon"
import { ScoreBar } from "@/components/admin/leads/score-bar"
import { cn } from "@/lib/utils"

const ESTADOS = leadEstado.enumValues

/** Tarjetas que se traen del servidor por tanda al hacer scroll. */
const PAGE_SIZE = 8

export interface LeadsKanbanProps {
  /** Filtros activos (server-side); cada columna añade su propio estado. */
  filtros: FetchLeadsFiltros
}

/**
 * Vista kanban del listado de leads: una columna por estado. Cada columna trae
 * SUS leads del servidor (fetchLeads con el estado), con buscador propio y
 * scroll infinito (carga incremental por offset).
 */
export function LeadsKanban({ filtros }: LeadsKanbanProps) {
  const filtrosKey = JSON.stringify(filtros)
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-start gap-3 overflow-x-auto p-3">
        {ESTADOS.map((estado) => (
          <KanbanColumn
            key={estado}
            estado={estado}
            filtros={filtros}
            filtrosKey={filtrosKey}
          />
        ))}
      </div>
    </Card>
  )
}

/** Columna de un estado: buscador propio + lista con scroll infinito server-side. */
function KanbanColumn({
  estado,
  filtros,
  filtrosKey,
}: {
  estado: string
  filtros: FetchLeadsFiltros
  filtrosKey: string
}) {
  const [q, setQ] = useState("")
  const [qEff, setQEff] = useState("")
  const [items, setItems] = useState<LeadRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Token de petición: descarta respuestas obsoletas tras cambiar filtro/búsqueda.
  const reqRef = useRef(0)

  // Debounce de la búsqueda de la columna.
  useEffect(() => {
    const t = setTimeout(() => setQEff(q), 250)
    return () => clearTimeout(t)
  }, [q])

  // Filtros efectivos de la columna (incluye su estado y su búsqueda).
  const colFiltros = useMemo<FetchLeadsFiltros>(
    () => ({ ...filtros, estado, busqueda: qEff.trim() || filtros.busqueda }),
    // filtros se captura por closure; filtrosKey es la dependencia estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey, estado, qEff],
  )

  // Primera página (reinicia al cambiar filtros o búsqueda de la columna).
  useEffect(() => {
    const token = ++reqRef.current
    setLoading(true)
    fetchLeads({ filtros: colFiltros, limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (token === reqRef.current) {
          setItems(res.rows)
          setTotal(res.total)
          setLoading(false)
        }
      })
      .catch(() => {
        if (token === reqRef.current) setLoading(false)
      })
  }, [colFiltros])

  const hayMas = items.length < total

  const cargarMas = useCallback(() => {
    if (loadingMore) return
    setLoadingMore(true)
    const token = reqRef.current
    fetchLeads({ filtros: colFiltros, limit: PAGE_SIZE, offset: items.length })
      .then((res) => {
        if (token === reqRef.current) {
          setItems((prev) => [...prev, ...res.rows])
          setTotal(res.total)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [colFiltros, items.length, loadingMore])

  // Scroll infinito: al ver el centinela dentro de la columna, carga otra tanda.
  useEffect(() => {
    if (!hayMas || loading) return
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cargarMas()
      },
      { root, rootMargin: "0px 0px 160px 0px" },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [hayMas, loading, cargarMas])

  return (
    <section
      className={cn(
        "flex min-w-60 flex-1 flex-col rounded-2xl border",
        "border-stone-200/70 bg-stone-50/60 dark:border-border dark:bg-muted/30",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-brand dark:text-foreground">
          {labelFor(estado)}
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {total}
        </span>
      </header>

      {/* Buscador de la columna */}
      <div className="px-2.5 pb-2 pt-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-stone-400 dark:text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            aria-label={`Buscar en ${labelFor(estado)}`}
            className={cn(
              "h-7 w-full rounded-md border border-stone-200 bg-white pl-7 pr-2 text-xs outline-none transition-colors",
              "placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-ring/50",
              "dark:border-border dark:bg-background dark:placeholder:text-muted-foreground",
            )}
          />
        </div>
      </div>

      {/* Lista con scroll vertical propio + carga incremental */}
      <div
        ref={scrollRef}
        className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      >
        {loading ? (
          <p className="py-6 text-center text-xs text-stone-400 dark:text-muted-foreground">
            Cargando…
          </p>
        ) : items.length > 0 ? (
          <>
            {items.map((lead) => (
              <LeadKanbanCard key={lead.id} lead={lead} />
            ))}
            {hayMas ? (
              <div
                ref={sentinelRef}
                className="py-2 text-center text-xs text-stone-400 dark:text-muted-foreground"
              >
                {loadingMore ? "Cargando…" : ""}
              </div>
            ) : null}
          </>
        ) : (
          <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-stone-400 dark:border-border dark:text-muted-foreground">
            {qEff.trim() ? "Sin coincidencias" : "Vacío"}
          </p>
        )}
      </div>
    </section>
  )
}

/** Tarjeta individual de un lead dentro del kanban. */
function LeadKanbanCard({ lead }: { lead: LeadRow }) {
  return (
    <Link
      href={`/je-admin/leads/${lead.id}`}
      className={cn(
        "block rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-colors",
        "hover:border-stone-300 hover:bg-stone-50",
        "dark:border-border dark:bg-card dark:hover:bg-muted/40",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
  )
}
