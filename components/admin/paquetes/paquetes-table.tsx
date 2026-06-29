"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Power, PowerOff, Trash2, AlertTriangle } from "lucide-react"

import type { PaqueteRow, PaquetesFiltros, PaquetesPage } from "@/lib/admin/queries"
import { fetchPaquetes, togglePaqueteActivo, eliminarPaquete } from "@/lib/admin/actions"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"

const PAGE_SIZE = 12

const SEGMENTO_LABEL: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  industrial: "Industrial",
}

export interface PaquetesTableProps {
  filtros: PaquetesFiltros
  puedeEditar: boolean
  onEdit: (paquete: PaqueteRow) => void
  reloadToken: number
}

function fmtMxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
}

/** Tabla de paquetes con paginación server-side. Clic en fila abre el detalle. */
export function PaquetesTable({ filtros, puedeEditar, onEdit, reloadToken }: PaquetesTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaquetesPage>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)

  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number): Promise<PaquetesPage> =>
      fetchPaquetes({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
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

  function irADetalle(row: PaqueteRow): void {
    router.push(`/je-admin/paquetes/${row.id}`)
  }

  function toggle(row: PaqueteRow): void {
    startTransition(async () => {
      await togglePaqueteActivo(row.id, !row.activo)
      setData(await fetchPage(page))
      router.refresh()
    })
  }

  function borrar(row: PaqueteRow): void {
    startTransition(async () => {
      await eliminarPaquete(row.id)
      setData(await fetchPage(page))
      router.refresh()
    })
  }

  const badge = (texto: string, tono: "verde" | "ambar" | "gris") => {
    const clase =
      tono === "verde"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        : tono === "ambar"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          : "bg-stone-100 text-stone-500 dark:bg-muted dark:text-muted-foreground"
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>
        {texto}
      </span>
    )
  }

  const columns: ReadonlyArray<DataTableColumn<PaqueteRow>> = [
    {
      id: "nombre",
      header: "Paquete",
      accessor: (r) => r.nombre,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
          <span className="text-xs text-stone-500 dark:text-muted-foreground">
            {SEGMENTO_LABEL[r.segmento] ?? r.segmento}
            {r.capacidadKwp != null ? ` · ${r.capacidadKwp} kWp` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "lineas",
      header: "Líneas",
      accessor: (r) => r.lineas,
      align: "end",
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums text-muted-foreground">{r.lineas}</span>,
    },
    {
      id: "total",
      header: "Total",
      accessor: (r) => r.total,
      align: "end",
      render: (r) => <span className="tabular-nums text-stone-700 dark:text-foreground">{fmtMxn(r.total)}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (r) => (r.activo ? 1 : 0),
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.activo ? badge("Activo", "verde") : badge("Inactivo", "gris")}
          {r.desactualizadas > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="size-3" aria-hidden />
              {r.desactualizadas} precio{r.desactualizadas === 1 ? "" : "s"} desactualizado{r.desactualizadas === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<PaqueteRow>> | undefined = puedeEditar
    ? [
        { label: "Editar datos", icon: <Pencil className="size-4" />, onSelect: onEdit },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: toggle,
          hidden: (r) => !r.activo,
          confirm: {
            title: "Desactivar paquete",
            description: (r) => (
              <>
                <strong>{r.nombre}</strong> dejará de ofrecerse en cotizaciones. ¿Continuar?
              </>
            ),
            confirmLabel: "Desactivar",
          },
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: toggle,
          hidden: (r) => r.activo,
        },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: borrar,
          confirm: {
            title: "Eliminar paquete",
            description: (r) => (
              <>
                Se eliminará <strong>{r.nombre}</strong> y sus líneas. Las cotizaciones ya
                generadas no se ven afectadas. ¿Continuar?
              </>
            ),
            confirmLabel: "Eliminar",
          },
        },
      ]
    : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <DataTable<PaqueteRow>
      data={data.rows}
      columns={columns}
      rowKey={(r) => r.id}
      onRowClick={irADetalle}
      rowActions={rowActions}
      loading={loading}
      mobileCard={(r) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
            {r.activo ? badge("Activo", "verde") : badge("Inactivo", "gris")}
          </div>
          <p className="text-xs text-stone-600 dark:text-muted-foreground">
            {SEGMENTO_LABEL[r.segmento] ?? r.segmento}
            {r.capacidadKwp != null ? ` · ${r.capacidadKwp} kWp` : ""} · {r.lineas} líneas
          </p>
          <p className="text-sm tabular-nums text-stone-700 dark:text-foreground">{fmtMxn(r.total)}</p>
          {r.desactualizadas > 0 ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="size-3" aria-hidden />
              {r.desactualizadas} precio{r.desactualizadas === 1 ? "" : "s"} desactualizado{r.desactualizadas === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      )}
      pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
      empty={{ title: "Sin paquetes", description: "Crea tu primer paquete para armar cotizaciones más rápido." }}
    />
  )
}
