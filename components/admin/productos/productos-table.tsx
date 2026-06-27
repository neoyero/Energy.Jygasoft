"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react"

import type {
  ProductoRecord,
  ProductosFiltros,
  ProductosPage,
} from "@/lib/admin/queries"
import {
  fetchProductos,
  toggleProductoActivo,
  eliminarProducto,
} from "@/lib/admin/actions"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"

const PAGE_SIZE = 12

export interface ProductosTableProps {
  /** Filtros activos (server-side); cambia => recarga desde la página 1. */
  filtros: ProductosFiltros
  /** RBAC productos:edit -> habilita editar / activar-desactivar. */
  puedeEditar: boolean
  /** Solo admin puede borrar (la action también lo exige). */
  puedeEliminar: boolean
  /** Abre el formulario de edición (gestionado por el contenedor). */
  onEdit: (producto: ProductoRecord) => void
  /** Cambia para forzar recarga tras crear/editar desde el contenedor. */
  reloadToken: number
}

/** Formatea un precio en MXN (o la moneda dada). */
function fmtPrecio(valor: number | null, moneda: string): string {
  if (valor == null) return "—"
  return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

/**
 * Tabla de productos con paginación SERVER-SIDE (fetchProductos). Al cambiar los
 * filtros o el reloadToken vuelve a cargar. Las acciones por fila editan,
 * activan/desactivan o eliminan, recargando la página y refrescando el RSC.
 */
export function ProductosTable({
  filtros,
  puedeEditar,
  puedeEliminar,
  onEdit,
  reloadToken,
}: ProductosTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ProductosPage>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)

  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number): Promise<ProductosPage> =>
      fetchProductos({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey],
  )

  // Al cambiar los filtros, vuelve a la página 1.
  useEffect(() => {
    setPage(1)
  }, [filtrosKey])

  // Carga la página actual (con guard anti-carrera). reloadToken fuerza recarga.
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

  function toggle(row: ProductoRecord): void {
    startTransition(async () => {
      await toggleProductoActivo(row.id, !row.activo)
      const res = await fetchPage(page)
      setData(res)
      router.refresh()
    })
  }

  function borrar(row: ProductoRecord): void {
    startTransition(async () => {
      await eliminarProducto(row.id)
      const res = await fetchPage(page)
      setData(res)
      router.refresh()
    })
  }

  const columns: ReadonlyArray<DataTableColumn<ProductoRecord>> = [
    {
      id: "nombre",
      header: "Producto",
      accessor: (row) => row.nombre,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">
            {row.nombre}
          </span>
          {row.marca || row.modelo ? (
            <span className="text-xs text-stone-500 dark:text-muted-foreground">
              {[row.marca, row.modelo].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessor: (row) => row.tipoNombre,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.tipoNombre}
        </span>
      ),
    },
    {
      id: "sku",
      header: "SKU",
      accessor: (row) => row.sku ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.sku ?? "—"}
        </span>
      ),
    },
    {
      id: "precioVenta",
      header: "Precio venta",
      accessor: (row) => row.precioVenta ?? 0,
      align: "end",
      render: (row) => (
        <span className="tabular-nums text-stone-700 dark:text-foreground">
          {fmtPrecio(row.precioVenta, row.moneda)}
        </span>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      accessor: (row) => row.stock ?? -1,
      align: "end",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-600 dark:text-muted-foreground">
          {row.stock ?? "—"}
        </span>
      ),
    },
    {
      id: "activo",
      header: "Estado",
      accessor: (row) => (row.activo ? 1 : 0),
      render: (row) => (
        <span
          className={
            row.activo
              ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground"
          }
        >
          {row.activo ? "Activo" : "Inactivo"}
        </span>
      ),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<ProductoRecord>> | undefined =
    puedeEditar
      ? [
          {
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onSelect: onEdit,
          },
          {
            label: "Desactivar",
            icon: <PowerOff className="size-4" />,
            onSelect: toggle,
            hidden: (row) => !row.activo,
            confirm: {
              title: "Desactivar producto",
              description: (row) => (
                <>
                  <strong>{row.nombre}</strong> dejará de estar disponible para
                  cotizar. ¿Continuar?
                </>
              ),
              confirmLabel: "Desactivar",
            },
          },
          {
            label: "Activar",
            icon: <Power className="size-4" />,
            onSelect: toggle,
            hidden: (row) => row.activo,
          },
          ...(puedeEliminar
            ? [
                {
                  label: "Eliminar",
                  icon: <Trash2 className="size-4" />,
                  destructive: true,
                  onSelect: borrar,
                  confirm: {
                    title: "Eliminar producto",
                    description: (row: ProductoRecord) => (
                      <>
                        Se eliminará <strong>{row.nombre}</strong> de forma
                        permanente. Si está en uso, desactívalo en su lugar.
                      </>
                    ),
                    confirmLabel: "Eliminar",
                  },
                } satisfies DataTableRowAction<ProductoRecord>,
              ]
            : []),
        ]
      : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <DataTable<ProductoRecord>
      data={data.rows}
      columns={columns}
      rowKey={(row) => row.id}
      rowActions={rowActions}
      loading={loading}
      mobileCard={(row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-stone-800 dark:text-foreground">
              {row.nombre}
            </span>
            <span
              className={
                row.activo
                  ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground"
              }
            >
              {row.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-muted-foreground">
            {row.tipoNombre}
            {row.marca || row.modelo
              ? ` · ${[row.marca, row.modelo].filter(Boolean).join(" · ")}`
              : ""}
          </p>
          <p className="text-sm tabular-nums text-stone-700 dark:text-foreground">
            {fmtPrecio(row.precioVenta, row.moneda)}
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
        title: "Sin productos",
        description: "No hay productos que coincidan con los filtros actuales.",
      }}
    />
  )
}
