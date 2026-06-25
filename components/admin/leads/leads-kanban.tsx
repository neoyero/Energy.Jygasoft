"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { leadEstado } from "@/db/schema"
import type { LeadRow } from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Card } from "@/components/admin/ui/card"
import { CanalIcon } from "@/components/admin/leads/canal-icon"
import { ScoreBar } from "@/components/admin/leads/score-bar"
import { cn } from "@/lib/utils"

const ESTADOS = leadEstado.enumValues

/** Tarjetas que se cargan por tanda al hacer scroll dentro de una columna. */
const PAGE_SIZE = 8

export interface LeadsKanbanProps {
  rows: ReadonlyArray<LeadRow>
}

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * Vista kanban del listado de leads: una columna por estado (leadEstado). Cada
 * columna tiene su propio buscador (nombre/teléfono/email) y carga incremental
 * por scroll (scroll infinito dentro de la columna). Datos ya filtrados en el
 * contenedor (LeadsView); aquí solo se agrupan por estado.
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
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-start gap-3 overflow-x-auto p-3">
        {ESTADOS.map((estado) => (
          <KanbanColumn
            key={estado}
            estado={estado}
            items={porEstado.get(estado) ?? []}
          />
        ))}
      </div>
    </Card>
  )
}

/** Columna de un estado: buscador propio + lista con scroll infinito. */
function KanbanColumn({
  estado,
  items,
}: {
  estado: string
  items: LeadRow[]
}) {
  const [q, setQ] = useState("")
  const [visible, setVisible] = useState(PAGE_SIZE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Filtra dentro de la columna por nombre, teléfono o email.
  const filtrados = useMemo(() => {
    const termino = normalizar(q.trim())
    if (termino === "") return items
    return items.filter((lead) =>
      normalizar(
        [lead.nombre, lead.telefono, lead.email].filter(Boolean).join(" "),
      ).includes(termino),
    )
  }, [items, q])

  // Reinicia la carga incremental al cambiar el filtro o los datos.
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [q, items])

  const mostrados = filtrados.slice(0, visible)
  const hayMas = visible < filtrados.length

  // Scroll infinito: al entrar el centinela en el área visible de la columna,
  // se carga la siguiente tanda.
  useEffect(() => {
    if (!hayMas) return
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => v + PAGE_SIZE)
        }
      },
      { root, rootMargin: "0px 0px 160px 0px" },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [hayMas, filtrados.length])

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
          {items.length}
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
        {mostrados.length > 0 ? (
          <>
            {mostrados.map((lead) => (
              <LeadKanbanCard key={lead.id} lead={lead} />
            ))}
            {hayMas ? (
              <div
                ref={sentinelRef}
                className="py-2 text-center text-xs text-stone-400 dark:text-muted-foreground"
              >
                Cargando…
              </div>
            ) : null}
          </>
        ) : (
          <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-stone-400 dark:border-border dark:text-muted-foreground">
            {q.trim() ? "Sin coincidencias" : "Vacío"}
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
