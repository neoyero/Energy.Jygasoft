"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutGrid, Plus, Table2, X } from "lucide-react"

import type {
  LeadRow,
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
import { cn } from "@/lib/utils"

type Vista = "tabla" | "kanban"

export interface LeadsViewProps {
  leadsIniciales: ReadonlyArray<LeadRow>
  resumen: LeadsResumen
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC leads:edit -> habilita acciones de reasignacion. */
  puedeEditar: boolean
  /** vendedor/preventa: oculta el filtro de vendedor. */
  rolScoped: boolean
}

/** Normaliza texto para busqueda: minusculas y sin acentos (marcas diacriticas). */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * Devuelve la fecha (epoch ms) de createdAt o null si es invalida.
 */
function fechaMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Contenedor cliente del listado de leads. Mantiene el estado de filtros y la
 * vista activa (tabla/kanban), aplica una busqueda con debounce simple y filtra
 * los leads ya cargados con useMemo. Renderiza chips de resumen por estado
 * (clic = filtra), la barra de filtros y la vista seleccionada.
 */
export function LeadsView({
  leadsIniciales,
  resumen,
  vendedores,
  puedeEditar,
  rolScoped,
}: LeadsViewProps) {
  const [filtros, setFiltros] = useState<LeadsFiltrosUI>(FILTROS_INICIALES)
  const [vista, setVista] = useState<Vista>("tabla")
  const [creando, setCreando] = useState(false)

  // Debounce simple de la busqueda: el input actualiza filtros.busqueda de
  // inmediato, pero el termino efectivo se aplica 250 ms despues.
  const [busquedaEfectiva, setBusquedaEfectiva] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaEfectiva(filtros.busqueda)
    }, 250)
    return () => clearTimeout(timer)
  }, [filtros.busqueda])

  // Filtrado en cliente sobre los datos ya cargados (inmutable: nuevo array).
  const leadsFiltrados = useMemo(() => {
    const termino = normalizar(busquedaEfectiva.trim())
    const desdeMs = fechaMs(filtros.desde)
    // "hasta" incluye todo el dia: sumamos ~24h en epoch.
    const hastaMs = (() => {
      const base = fechaMs(filtros.hasta)
      return base === null ? null : base + 24 * 60 * 60 * 1000
    })()

    return leadsIniciales.filter((lead) => {
      if (filtros.estado !== null && lead.estado !== filtros.estado) return false
      if (filtros.canal !== null && lead.canal !== filtros.canal) return false

      if (filtros.vendedor !== null) {
        if (filtros.vendedor === SIN_ASIGNAR) {
          if (lead.vendedorId !== null) return false
        } else if (lead.vendedorId !== filtros.vendedor) {
          return false
        }
      }

      if (filtros.scoreMin !== null && lead.score < filtros.scoreMin) return false

      if (desdeMs !== null || hastaMs !== null) {
        const creado = fechaMs(lead.createdAt)
        if (creado === null) return false
        if (desdeMs !== null && creado < desdeMs) return false
        if (hastaMs !== null && creado >= hastaMs) return false
      }

      if (termino !== "") {
        const campos = normalizar(
          [lead.nombre, lead.email, lead.telefono, lead.municipio, lead.estadoMx]
            .filter(Boolean)
            .join(" ")
        )
        if (!campos.includes(termino)) return false
      }

      return true
    })
  }, [leadsIniciales, busquedaEfectiva, filtros])

  // Alterna el chip de estado: si ya esta activo, lo limpia; si no, lo aplica.
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

      {/* Filtros + toggle de vista */}
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
              variant={creando ? "outline" : "default"}
              onClick={() => setCreando((prev) => !prev)}
            >
              {creando ? (
                <>
                  <X className="size-4" aria-hidden />
                  Cerrar
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden />
                  Nuevo lead
                </>
              )}
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

      {/* Form de alta (plegable) */}
      {puedeEditar && creando ? (
        <LeadForm
          modo="crear"
          vendedores={vendedores}
          onSuccess={() => setCreando(false)}
        />
      ) : null}

      {/* Vista activa */}
      {vista === "tabla" ? (
        <LeadsTable
          rows={leadsFiltrados}
          puedeEditar={puedeEditar}
          vendedores={vendedores}
        />
      ) : (
        <LeadsKanban rows={leadsFiltrados} />
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
