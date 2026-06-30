"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react"

import type { ActividadAgendaRow, ActividadesFiltros } from "@/lib/admin/queries"
import {
  fetchActividades,
  completarActividad,
  cancelarActividad,
  eliminarActividad,
} from "@/lib/admin/actions"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { fmtFechaRel } from "@/lib/admin/format"
import {
  ENTIDAD_LABEL,
  iconForTipo,
  rutaEntidad,
} from "@/components/admin/actividades/actividad-utils"

const PAGE_SIZE = 15

const EMPTY_PAGE = { rows: [] as ActividadAgendaRow[], total: 0, hasMore: false }

export interface ActividadesTableProps {
  filtros: ActividadesFiltros
  puedeEditar: boolean
  puedeEliminar: boolean
  onEdit: (row: ActividadAgendaRow) => void
  /** Cambia para forzar recarga tras crear/editar desde el contenedor. */
  reloadToken: number
  /** Notifica al contenedor que cambió algo (para refrescar el resumen). */
  onChanged: () => void
}

/**
 * Tabla de la agenda global de actividades con paginación SERVER-SIDE
 * (fetchActividades). Click en fila navega a la ficha de la entidad dueña; las
 * acciones por fila completan/reabren, cancelan/reactivan, editan o eliminan.
 */
export function ActividadesTable({
  filtros,
  puedeEditar,
  puedeEliminar,
  onEdit,
  reloadToken,
  onChanged,
}: ActividadesTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [data, setData] = useState(EMPTY_PAGE)
  const [loading, setLoading] = useState(true)

  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number) =>
      fetchActividades({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
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

  /** Ejecuta una mutación y recarga la página + resumen. */
  function mutar(fn: () => Promise<{ ok: boolean }>): void {
    startTransition(async () => {
      await fn()
      const res = await fetchPage(page)
      setData(res)
      onChanged()
      router.refresh()
    })
  }

  function abrirEntidad(row: ActividadAgendaRow): void {
    const ruta = rutaEntidad(row.entidadTipo, row.entidadId)
    if (ruta) router.push(ruta)
  }

  const columns: ReadonlyArray<DataTableColumn<ActividadAgendaRow>> = [
    {
      id: "titulo",
      header: "Actividad",
      accessor: (row) => row.titulo,
      render: (row) => {
        const Icon = iconForTipo(row.tipo)
        const completada = row.estado === "completada"
        const cancelada = row.estado === "cancelada"
        return (
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/5 text-brand dark:bg-muted dark:text-muted-foreground"
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <span
              className={
                completada || cancelada
                  ? "font-medium text-stone-400 line-through dark:text-muted-foreground"
                  : "font-medium text-stone-800 dark:text-foreground"
              }
            >
              {row.titulo}
            </span>
          </div>
        )
      },
    },
    {
      id: "entidad",
      header: "Asociada a",
      accessor: (row) => row.entidadNombre ?? "",
      hideOnMobile: true,
      render: (row) =>
        row.entidadTipo ? (
          <div className="flex flex-col">
            <span className="text-stone-700 dark:text-foreground">
              {row.entidadNombre ?? "—"}
            </span>
            <span className="text-xs text-stone-400 dark:text-muted-foreground">
              {ENTIDAD_LABEL[row.entidadTipo] ?? row.entidadTipo}
            </span>
          </div>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    {
      id: "prioridad",
      header: "Prioridad",
      accessor: (row) => row.prioridad,
      hideOnMobile: true,
      render: (row) => <StatusBadge value={row.prioridad} />,
    },
    {
      id: "asignado",
      header: "Asignado",
      accessor: (row) => row.asignadoNombre ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.asignadoNombre ?? "Sin asignar"}
        </span>
      ),
    },
    {
      id: "vence",
      header: "Vence",
      accessor: (row) => row.venceAt,
      sortable: true,
      render: (row) => {
        const rel = fmtFechaRel(row.venceAt)
        return row.vencida ? (
          <span className="font-medium text-destructive">{`Vencida · ${rel}`}</span>
        ) : (
          <span className="text-stone-600 dark:text-muted-foreground">{rel}</span>
        )
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (row) => row.estado,
      render: (row) => <StatusBadge value={row.estado} />,
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<ActividadAgendaRow>> | undefined =
    puedeEditar
      ? [
          {
            label: "Completar",
            icon: <CheckCircle2 className="size-4" />,
            onSelect: (row) => mutar(() => completarActividad(row.id, true)),
            hidden: (row) => row.estado !== "pendiente",
          },
          {
            label: "Reabrir",
            icon: <RotateCcw className="size-4" />,
            onSelect: (row) => mutar(() => completarActividad(row.id, false)),
            hidden: (row) => row.estado !== "completada",
          },
          {
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onSelect: onEdit,
          },
          {
            label: "Cancelar",
            icon: <XCircle className="size-4" />,
            onSelect: (row) => mutar(() => cancelarActividad(row.id, true)),
            hidden: (row) => row.estado === "cancelada",
            confirm: {
              title: "Cancelar actividad",
              description: (row) => (
                <>
                  Se marcará <strong>{row.titulo}</strong> como cancelada. Podrás
                  reactivarla después.
                </>
              ),
              confirmLabel: "Cancelar actividad",
            },
          },
          {
            label: "Reactivar",
            icon: <RotateCcw className="size-4" />,
            onSelect: (row) => mutar(() => cancelarActividad(row.id, false)),
            hidden: (row) => row.estado !== "cancelada",
          },
          ...(puedeEliminar
            ? [
                {
                  label: "Eliminar",
                  icon: <Trash2 className="size-4" />,
                  destructive: true,
                  onSelect: (row: ActividadAgendaRow) =>
                    mutar(() => eliminarActividad(row.id)),
                  confirm: {
                    title: "Eliminar actividad",
                    description: (row: ActividadAgendaRow) => (
                      <>
                        Se eliminará <strong>{row.titulo}</strong> de forma
                        permanente.
                      </>
                    ),
                    confirmLabel: "Eliminar",
                  },
                } satisfies DataTableRowAction<ActividadAgendaRow>,
              ]
            : []),
        ]
      : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <DataTable<ActividadAgendaRow>
      data={data.rows}
      columns={columns}
      rowKey={(row) => row.id}
      rowActions={rowActions}
      loading={loading}
      onRowClick={abrirEntidad}
      defaultSort={{ columnId: "vence", direction: "asc" }}
      mobileCard={(row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-stone-800 dark:text-foreground">
              {row.titulo}
            </span>
            <StatusBadge value={row.estado} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge value={row.prioridad} />
            {row.entidadTipo ? (
              <span className="text-xs text-stone-500 dark:text-muted-foreground">
                {(ENTIDAD_LABEL[row.entidadTipo] ?? row.entidadTipo)}
                {row.entidadNombre ? ` · ${row.entidadNombre}` : ""}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-stone-600 dark:text-muted-foreground">
            {row.vencida ? "Vencida · " : "Vence "}
            {fmtFechaRel(row.venceAt)} · {row.asignadoNombre ?? "Sin asignar"}
          </p>
        </div>
      )}
      pageControl={{
        page,
        pageCount,
        total: data.total,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
      }}
      empty={{
        title: "Sin actividades",
        description: "No hay actividades que coincidan con los filtros actuales.",
      }}
    />
  )
}
