"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Pencil, Power, PowerOff, Trash2 } from "lucide-react"

import type { AreaRow, AreasFiltros, AreasPage } from "@/lib/admin/queries"
import { fetchAreas, toggleAreaActiva, eliminarArea } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { AreaForm } from "@/components/admin/areas/area-form"

const PAGE_SIZE = 15

export interface AreasViewProps {
  puedeEditar: boolean
  /** Usuarios para el selector de líder en el formulario. */
  usuarios: ReadonlyArray<{ id: string; nombre: string }>
}

/** Listado de áreas (departamentos): buscador + solo activas, alta/edición en modal. */
export function AreasView({ puedeEditar, usuarios }: AreasViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AreasPage>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<AreaRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: AreasFiltros = useMemo(
    () => ({ busqueda: busquedaEf.trim() || undefined, soloActivas: soloActivas || undefined }),
    [busquedaEf, soloActivas],
  )
  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number): Promise<AreasPage> =>
      fetchAreas({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
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
  function accion(fn: () => Promise<unknown>): void {
    startTransition(async () => {
      await fn()
      setData(await fetchPage(page))
      router.refresh()
    })
  }

  const estadoBadge = (activa: boolean) =>
    activa ? (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        Activa
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
        Inactiva
      </span>
    )

  const columns: ReadonlyArray<DataTableColumn<AreaRow>> = [
    {
      id: "nombre",
      header: "Área",
      accessor: (r) => r.nombre,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
          {r.descripcion ? (
            <span className="text-xs text-stone-500 dark:text-muted-foreground">{r.descripcion}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "lider",
      header: "Líder",
      accessor: (r) => r.liderNombre ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-stone-600 dark:text-muted-foreground">{r.liderNombre ?? "—"}</span>
      ),
    },
    {
      id: "miembros",
      header: "Miembros",
      accessor: (r) => r.miembros,
      align: "end",
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums text-stone-600 dark:text-muted-foreground">{r.miembros}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (r) => (r.activa ? 1 : 0),
      render: (r) => estadoBadge(r.activa),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<AreaRow>> | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditando(r) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: (r) => accion(() => toggleAreaActiva(r.id, false)),
          hidden: (r) => !r.activa,
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: (r) => accion(() => toggleAreaActiva(r.id, true)),
          hidden: (r) => r.activa,
        },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => eliminarArea(r.id)),
          confirm: {
            title: "Eliminar área",
            description: (r) => (
              <>
                Se eliminará <strong>{r.nombre}</strong>. Los miembros quedarán sin área asignada.
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
            <label htmlFor="a-busqueda" className="block text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="a-busqueda"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre…"
                className="w-56 pl-8"
              />
            </div>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Solo activas
          </label>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => { setEditando(null); setCreando(true) }}>
            <Plus className="size-4" aria-hidden /> Nueva área
          </Button>
        ) : null}
      </div>

      <DataTable<AreaRow>
        data={data.rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={puedeEditar ? (r) => setEditando(r) : undefined}
        rowActions={rowActions}
        loading={loading}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
              <span className="text-xs text-stone-600 dark:text-muted-foreground">
                {(r.liderNombre ?? "Sin líder")} · {r.miembros} miembro{r.miembros === 1 ? "" : "s"}
              </span>
            </div>
            {estadoBadge(r.activa)}
          </div>
        )}
        pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
        empty={{ title: "Sin áreas", description: "Crea la primera área/departamento." }}
      />

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => { if (!abierto) cerrar() }}
          title={editando ? "Editar área" : "Nueva área"}
          size="lg"
          dismissable={!saving}
        >
          <AreaForm
            key={editando?.id ?? "nueva"}
            modo={editando ? "editar" : "crear"}
            area={editando ?? undefined}
            usuarios={usuarios}
            onSuccess={trasGuardar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}
