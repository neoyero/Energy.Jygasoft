"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"

import type { CampanaRow, CampanasFiltros, CampanasPage } from "@/lib/admin/queries"
import { fetchCampanas, eliminarCampana } from "@/lib/admin/actions"
import { campanaEstado, campanaPlataforma } from "@/db/schema"
import { formatMXN, formatInt } from "@/lib/admin/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { CampanaForm } from "@/components/admin/campanas/campana-form"

const PAGE_SIZE = 15
const EMPTY: CampanasPage = { rows: [], total: 0 }
const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface CampanasViewProps {
  puedeEditar: boolean
}

/** Importe en la moneda de la campaña; null -> em-dash. */
function money(v: number | null, moneda: string): string {
  if (v == null) return "—"
  return `${formatMXN(v)}${moneda && moneda !== "MXN" ? ` ${moneda}` : ""}`
}

/**
 * Listado de campañas de marketing: métricas (presupuesto/gasto), leads
 * atribuidos (leads.campana_id) y CPL. Filtros por estado/plataforma/búsqueda,
 * tabla paginada server-side y CRUD en modal.
 */
export function CampanasView({ puedeEditar }: CampanasViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [estado, setEstado] = useState("")
  const [plataforma, setPlataforma] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CampanasPage>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<CampanaRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: CampanasFiltros = useMemo(
    () => ({
      estado: estado || undefined,
      plataforma: plataforma || undefined,
      busqueda: busquedaEf.trim() || undefined,
    }),
    [estado, plataforma, busquedaEf],
  )
  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number) => fetchCampanas({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey],
  )

  useEffect(() => {
    setPage(1)
  }, [filtrosKey])

  useEffect(() => {
    let stale = false
    setLoading(true)
    fetchPage(page)
      .then((res) => {
        if (!stale) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [fetchPage, page, reloadToken])

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }
  function trasGuardar(): void {
    cerrar()
    setReloadToken((n) => n + 1)
  }
  function borrar(row: CampanaRow): void {
    startTransition(async () => {
      await eliminarCampana(row.id)
      setData(await fetchPage(page))
      router.refresh()
    })
  }

  const columns: ReadonlyArray<DataTableColumn<CampanaRow>> = [
    {
      id: "nombre",
      header: "Campaña",
      accessor: (r) => r.nombre,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
          <span className="text-xs text-stone-500 dark:text-muted-foreground">
            {labelFor(r.plataforma)}
            {r.utmCampaign ? ` · ${r.utmCampaign}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (r) => r.estado,
      render: (r) => <StatusBadge value={r.estado} />,
    },
    {
      id: "gasto",
      header: "Gasto",
      accessor: (r) => r.gasto ?? -1,
      align: "end",
      hideOnMobile: true,
      render: (r) => (
        <span className="tabular-nums text-stone-700 dark:text-foreground">
          {money(r.gasto, r.moneda)}
        </span>
      ),
    },
    {
      id: "leads",
      header: "Leads",
      accessor: (r) => r.leads,
      align: "end",
      render: (r) => (
        <span className="tabular-nums text-stone-700 dark:text-foreground">{formatInt(r.leads)}</span>
      ),
    },
    {
      id: "cpl",
      header: "CPL",
      accessor: (r) => r.cpl ?? -1,
      align: "end",
      hideOnMobile: true,
      render: (r) => (
        <span className="tabular-nums font-medium text-brand-green-dark dark:text-brand-green">
          {money(r.cpl, r.moneda)}
        </span>
      ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<CampanaRow>> | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditando(r) },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: borrar,
          confirm: {
            title: "Eliminar campaña",
            description: (r) => (
              <>
                Se eliminará <strong>{r.nombre}</strong>. Los leads atribuidos quedarán sin campaña.
                ¿Continuar?
              </>
            ),
            confirmLabel: "Eliminar",
          },
        },
      ]
    : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todos</option>
              {campanaEstado.enumValues.map((s) => (
                <option key={s} value={s}>
                  {labelFor(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Plataforma</label>
            <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)} className={SELECT_CLASS}>
              <option value="">Todas</option>
              {campanaPlataforma.enumValues.map((p) => (
                <option key={p} value={p}>
                  {labelFor(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre…"
                className="w-56 pl-8"
              />
            </div>
          </div>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => { setEditando(null); setCreando(true) }}>
            <Plus className="size-4" aria-hidden /> Nueva campaña
          </Button>
        ) : null}
      </div>

      <DataTable<CampanaRow>
        data={data.rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={puedeEditar ? (r) => setEditando(r) : undefined}
        rowActions={rowActions}
        loading={loading}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
              <StatusBadge value={r.estado} />
            </div>
            <p className="text-xs text-stone-500 dark:text-muted-foreground">
              {labelFor(r.plataforma)} · {formatInt(r.leads)} leads · CPL {money(r.cpl, r.moneda)}
            </p>
          </div>
        )}
        pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        empty={{ title: "Sin campañas", description: "Crea la primera campaña de marketing." }}
      />

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => { if (!abierto) cerrar() }}
          title={editando ? "Editar campaña" : "Nueva campaña"}
          size="2xl"
          dismissable={!saving}
        >
          <CampanaForm
            key={editando?.id ?? "nueva"}
            modo={editando ? "editar" : "crear"}
            campana={editando ?? undefined}
            onSuccess={trasGuardar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}
