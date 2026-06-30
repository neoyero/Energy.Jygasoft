"use client"

import { useEffect, useMemo, useState } from "react"
import { AlarmClock, CalendarClock, CalendarDays, Plus, Search, UserX } from "lucide-react"

import type {
  ActividadAgendaRow,
  ActividadesFiltros,
  ActividadesResumen,
  VendedorOption,
} from "@/lib/admin/queries"
import { actividadEstado, actividadTipo, actividadPrioridad } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import { labelFor } from "@/components/admin/ui/status-badge"
import { cn } from "@/lib/utils"
import { ActividadesTable } from "@/components/admin/actividades/actividades-table"
import {
  ActividadForm,
  type ActividadEditable,
} from "@/components/admin/actividades/actividad-form"

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

type Preset = "todas" | "vencidas" | "hoy" | "semana" | "sin_asignar"

export interface ActividadesViewProps {
  resumen: ActividadesResumen
  vendedores: ReadonlyArray<VendedorOption>
  puedeEditar: boolean
  puedeEliminar: boolean
}

/**
 * Agenda global de actividades. Chips de resumen (atajos de filtro), barra de
 * filtros (estado/tipo/prioridad/asignado/vencimiento/búsqueda con debounce),
 * tabla paginada server-side y modal de alta/edición. El resumen se recibe del
 * RSC y se refresca vía router.refresh() tras cada cambio.
 */
export function ActividadesView({
  resumen,
  vendedores,
  puedeEditar,
  puedeEliminar,
}: ActividadesViewProps) {
  const [preset, setPreset] = useState<Preset>("todas")
  const [estado, setEstado] = useState<string>("pendiente")
  const [tipo, setTipo] = useState<string>("")
  const [prioridad, setPrioridad] = useState<string>("")
  const [asignadoA, setAsignadoA] = useState<string>("")
  const [vence, setVence] = useState<string>("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<ActividadAgendaRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // Debounce búsqueda (250 ms).
  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: ActividadesFiltros = useMemo(
    () => ({
      estado: estado || undefined,
      tipo: tipo || undefined,
      prioridad: prioridad || undefined,
      asignadoA: asignadoA || undefined,
      vence: vence || undefined,
      busqueda: busquedaEf.trim() || undefined,
    }),
    [estado, tipo, prioridad, asignadoA, vence, busquedaEf],
  )

  /** Aplica un atajo de los chips de resumen (ajusta estado/vence/asignado). */
  function aplicarPreset(p: Preset): void {
    setPreset(p)
    setTipo("")
    setPrioridad("")
    switch (p) {
      case "vencidas":
        setEstado("pendiente")
        setVence("vencidas")
        setAsignadoA("")
        break
      case "hoy":
        setEstado("pendiente")
        setVence("hoy")
        setAsignadoA("")
        break
      case "semana":
        setEstado("pendiente")
        setVence("semana")
        setAsignadoA("")
        break
      case "sin_asignar":
        setEstado("pendiente")
        setVence("")
        setAsignadoA("sin")
        break
      default:
        setEstado("pendiente")
        setVence("")
        setAsignadoA("")
    }
  }

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }

  function trasGuardar(): void {
    cerrar()
    setReloadToken((n) => n + 1)
  }

  const editable: ActividadEditable | undefined = editando
    ? {
        id: editando.id,
        tipo: editando.tipo,
        titulo: editando.titulo,
        descripcion: editando.descripcion,
        prioridad: editando.prioridad,
        asignadoA: editando.asignadoA,
        venceAt: editando.venceAt,
      }
    : undefined

  return (
    <div className="flex flex-col gap-4">
      {/* Chips de resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chip
          activo={preset === "vencidas"}
          onClick={() => aplicarPreset("vencidas")}
          icon={<AlarmClock className="size-4" aria-hidden />}
          label="Vencidas"
          valor={resumen.vencidas}
          tone="danger"
        />
        <Chip
          activo={preset === "hoy"}
          onClick={() => aplicarPreset("hoy")}
          icon={<CalendarClock className="size-4" aria-hidden />}
          label="Para hoy"
          valor={resumen.hoy}
          tone="warning"
        />
        <Chip
          activo={preset === "semana"}
          onClick={() => aplicarPreset("semana")}
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Próximos 7 días"
          valor={resumen.proximas}
          tone="info"
        />
        <Chip
          activo={preset === "sin_asignar"}
          onClick={() => aplicarPreset("sin_asignar")}
          icon={<UserX className="size-4" aria-hidden />}
          label="Sin asignar"
          valor={resumen.sinAsignar}
          tone="neutral"
        />
      </div>

      {/* Filtros + acciones */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Filtro label="Estado">
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPreset("todas")
              }}
              className={SELECT_CLASS}
            >
              <option value="">Todos</option>
              {actividadEstado.enumValues.map((s) => (
                <option key={s} value={s}>
                  {labelFor(s)}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todos</option>
              {actividadTipo.enumValues.map((t) => (
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="Prioridad">
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Todas</option>
              {actividadPrioridad.enumValues.map((p) => (
                <option key={p} value={p}>
                  {labelFor(p)}
                </option>
              ))}
            </select>
          </Filtro>

          <Filtro label="Vence">
            <select
              value={vence}
              onChange={(e) => {
                setVence(e.target.value)
                setPreset("todas")
              }}
              className={SELECT_CLASS}
            >
              <option value="">Cualquiera</option>
              <option value="vencidas">Vencidas</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Próximos 7 días</option>
              <option value="sin_fecha">Sin fecha</option>
            </select>
          </Filtro>

          {vendedores.length > 1 ? (
            <Filtro label="Asignado">
              <select
                value={asignadoA}
                onChange={(e) => {
                  setAsignadoA(e.target.value)
                  setPreset("todas")
                }}
                className={SELECT_CLASS}
              >
                <option value="">Todos</option>
                <option value="sin">Sin asignar</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </Filtro>
          ) : null}

          <Filtro label="Buscar">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Título…"
                className="w-56 pl-8"
              />
            </div>
          </Filtro>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => setCreando(true)}>
            <Plus className="size-4" aria-hidden /> Nueva actividad
          </Button>
        ) : null}
      </div>

      <ActividadesTable
        filtros={filtros}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
        onEdit={(row) => setEditando(row)}
        reloadToken={reloadToken}
        onChanged={() => setReloadToken((n) => n + 1)}
      />

      {/* Alta / edición en modal */}
      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => {
            if (!abierto) cerrar()
          }}
          title={editando ? "Editar actividad" : "Nueva actividad"}
          description={
            editando
              ? "Modifica los datos de la actividad."
              : "Asóciala a una entidad y completa los datos."
          }
          size="2xl"
          dismissable={!saving}
        >
          <ActividadForm
            key={editando?.id ?? "nueva"}
            modo={editando ? "editar" : "crear"}
            actividad={editable}
            vendedores={vendedores}
            onSuccess={trasGuardar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

const CHIP_TONE: Record<string, string> = {
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  neutral: "text-stone-500 dark:text-muted-foreground",
}

function Chip({
  activo,
  onClick,
  icon,
  label,
  valor,
  tone,
}: {
  activo: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  valor: number
  tone: keyof typeof CHIP_TONE | string
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        activo
          ? "border-brand bg-brand/5 dark:border-primary dark:bg-primary/10"
          : "border-border hover:bg-stone-50 dark:hover:bg-muted",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={CHIP_TONE[tone] ?? CHIP_TONE.neutral}>{icon}</span>
        <span className="text-sm text-stone-600 dark:text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold tabular-nums text-stone-800 dark:text-foreground">
        {valor}
      </span>
    </button>
  )
}
