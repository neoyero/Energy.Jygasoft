"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutGrid, Plus, Table2 } from "lucide-react"

import type {
  FetchLeadsFiltros,
  LeadsResumen,
  VendedorOption,
} from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import {
  FILTROS_INICIALES,
  LeadsFilters,
  SIN_ASIGNAR,
  type LeadsFiltrosUI,
} from "@/components/admin/leads/leads-filters"
import { LeadsTable } from "@/components/admin/leads/leads-table"
import { LeadsKanban } from "@/components/admin/leads/leads-kanban"
import { LeadForm } from "@/components/admin/leads/lead-form"
import { Modal } from "@/components/admin/ui/modal"
import { cn } from "@/lib/utils"

type Vista = "tabla" | "kanban"

export interface LeadsViewProps {
  resumen: LeadsResumen
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC leads:edit -> habilita acciones de reasignacion y alta. */
  puedeEditar: boolean
  /** vendedor/preventa: oculta el filtro de vendedor. */
  rolScoped: boolean
}

/** yyyy-mm-dd -> día siguiente (para un rango "hasta" inclusivo con `<`). */
function diaSiguiente(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Mapea los filtros de la UI a los filtros serializables del servidor. */
function aFiltrosServidor(filtros: LeadsFiltrosUI): FetchLeadsFiltros {
  return {
    estado: filtros.estado ?? undefined,
    canal: filtros.canal ?? undefined,
    vendedorId:
      filtros.vendedor === null
        ? undefined
        : filtros.vendedor === SIN_ASIGNAR
          ? null
          : filtros.vendedor,
    scoreMin: typeof filtros.scoreMin === "number" ? filtros.scoreMin : undefined,
    busqueda: filtros.busqueda.trim() || undefined,
    desde: filtros.desde || undefined,
    hasta: filtros.hasta ? diaSiguiente(filtros.hasta) : undefined,
  }
}

/**
 * Contenedor cliente del listado de leads. Mantiene el estado de filtros y la
 * vista activa (tabla/kanban). Los filtros se serializan y se pasan a la vista,
 * que trae los datos del servidor (paginación / scroll infinito). Renderiza los
 * chips de resumen por estado, la barra de filtros, el alta y la vista activa.
 */
export function LeadsView({
  resumen,
  vendedores,
  puedeEditar,
  rolScoped,
}: LeadsViewProps) {
  const [filtros, setFiltros] = useState<LeadsFiltrosUI>(FILTROS_INICIALES)
  const [vista, setVista] = useState<Vista>("tabla")
  const [creando, setCreando] = useState(false)
  const [saving, setSaving] = useState(false)

  // Debounce simple de la búsqueda: el input actualiza filtros.busqueda de
  // inmediato, pero el término efectivo (que dispara fetch) se aplica 250 ms después.
  const [busquedaEfectiva, setBusquedaEfectiva] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaEfectiva(filtros.busqueda)
    }, 250)
    return () => clearTimeout(timer)
  }, [filtros.busqueda])

  // Filtros server-side derivados (usa la búsqueda con debounce).
  const fetchFiltros = useMemo(
    () => aFiltrosServidor({ ...filtros, busqueda: busquedaEfectiva }),
    [filtros, busquedaEfectiva],
  )

  // Alterna el chip de estado: si ya está activo, lo limpia; si no, lo aplica.
  function toggleEstado(estado: string): void {
    setFiltros((prev) => ({
      ...prev,
      estado: prev.estado === estado ? null : estado,
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Chips de resumen por estado (clic = filtra) */}
      <div className="flex flex-wrap items-center gap-2">
        <ChipResumen
          label="Todos"
          conteo={resumen.total}
          activo={filtros.estado === null}
          onClick={() => setFiltros((prev) => ({ ...prev, estado: null }))}
        />
        {resumen.porEstado.map((item) => (
          <ChipResumen
            key={item.estado}
            label={labelFor(item.estado)}
            conteo={item.n}
            activo={filtros.estado === item.estado}
            onClick={() => toggleEstado(item.estado)}
          />
        ))}
      </div>

      {/* Filtros + acciones */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LeadsFilters
          filtros={filtros}
          onChange={setFiltros}
          vendedores={vendedores}
          rolScoped={rolScoped}
        />

        <div className="flex shrink-0 items-center gap-2">
          {puedeEditar ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreando(true)}
            >
              <Plus className="size-4" aria-hidden />
              Nuevo lead
            </Button>
          ) : null}

          <div
            className="inline-flex rounded-lg border border-stone-200 p-0.5 dark:border-border"
            role="group"
            aria-label="Cambiar vista"
          >
            <BotonVista
              activo={vista === "tabla"}
              onClick={() => setVista("tabla")}
              label="Tabla"
            >
              <Table2 className="size-4" aria-hidden />
            </BotonVista>
            <BotonVista
              activo={vista === "kanban"}
              onClick={() => setVista("kanban")}
              label="Kanban"
            >
              <LayoutGrid className="size-4" aria-hidden />
            </BotonVista>
          </div>
        </div>
      </div>

      {/* Alta de lead en modal (responsive). */}
      {puedeEditar ? (
        <Modal
          open={creando}
          onOpenChange={(abierto) => {
            if (!abierto) setCreando(false)
          }}
          title="Nuevo lead"
          description="Registra un prospecto manualmente."
          size="3xl"
          dismissable={!saving}
        >
          <LeadForm
            modo="crear"
            vendedores={vendedores}
            onSuccess={() => setCreando(false)}
            onCancel={() => setCreando(false)}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}

      {/* Vista activa */}
      {vista === "tabla" ? (
        <LeadsTable
          filtros={fetchFiltros}
          puedeEditar={puedeEditar}
          vendedores={vendedores}
        />
      ) : (
        <LeadsKanban filtros={fetchFiltros} />
      )}
    </div>
  )
}

/** Chip de resumen por estado: muestra etiqueta + conteo y filtra al clic. */
function ChipResumen({
  label,
  conteo,
  activo,
  onClick,
}: {
  label: string
  conteo: number
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        activo
          ? "border-brand bg-brand/10 text-brand dark:border-primary dark:bg-primary/15 dark:text-foreground"
          : "border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-border dark:text-muted-foreground dark:hover:bg-muted"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-70">{conteo}</span>
    </button>
  )
}

/** Boton del toggle de vista (tabla/kanban). */
function BotonVista({
  activo,
  onClick,
  label,
  children,
}: {
  activo: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        activo
          ? "bg-brand text-white dark:bg-primary dark:text-primary-foreground"
          : "text-stone-500 hover:bg-stone-100 dark:text-muted-foreground dark:hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}
