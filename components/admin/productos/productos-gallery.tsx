"use client"

import { useCallback, useEffect, useState } from "react"
import { ImageOff, Pencil, ChevronLeft, ChevronRight } from "lucide-react"

import type { ProductoRecord, ProductosFiltros, ProductosPage } from "@/lib/admin/queries"
import { fetchProductos } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"

const PAGE_SIZE = 18

export interface ProductosGalleryProps {
  filtros: ProductosFiltros
  puedeEditar: boolean
  onEdit: (producto: ProductoRecord) => void
  reloadToken: number
}

function fmtPrecio(valor: number | null, moneda: string): string {
  if (valor == null) return "—"
  return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`
}

/** Galería de productos en tarjetas (imagen, marca, nombre, sku, precio, stock). */
export function ProductosGallery({ filtros, puedeEditar, onEdit, reloadToken }: ProductosGalleryProps) {
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

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  if (!loading && data.rows.length === 0) {
    return (
      <EmptyState
        title="Sin productos"
        description="No hay productos que coincidan con los filtros actuales."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {(loading ? Array.from({ length: 12 }) : data.rows).map((row, i) => {
          const p = row as ProductoRecord | undefined
          if (!p) {
            return (
              <div
                key={`skeleton-${i}`}
                className="h-64 animate-pulse rounded-xl border border-border bg-muted/40"
              />
            )
          }
          return (
            <div
              key={p.id}
              className={
                "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md" +
                (p.activo ? "" : " opacity-60")
              }
            >
              {/* Imagen */}
              <div className="relative flex aspect-square items-center justify-center bg-stone-50 dark:bg-muted/30">
                {p.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/je-admin/productos/imagen/${p.id}`}
                    alt={p.nombre}
                    className="size-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <ImageOff className="size-8 text-stone-300 dark:text-muted-foreground" aria-hidden />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-stone-600 shadow-sm dark:bg-stone-900/80 dark:text-muted-foreground">
                  {p.naturaleza === "servicio" ? "Servicio" : p.tipoNombre}
                </span>
                {!p.activo ? (
                  <span className="absolute right-2 top-2 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-muted dark:text-muted-foreground">
                    Inactivo
                  </span>
                ) : null}
              </div>

              {/* Datos */}
              <div className="flex flex-1 flex-col gap-1 p-3">
                {p.marca ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-brand dark:text-primary">
                    {p.marca}
                  </span>
                ) : null}
                <p className="line-clamp-2 text-sm font-medium leading-tight text-stone-800 dark:text-foreground">
                  {p.nombre}
                </p>
                {p.sku ? (
                  <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                ) : null}
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold tabular-nums text-stone-900 dark:text-foreground">
                      {fmtPrecio(p.precioVenta, p.moneda)}
                    </span>
                    {p.stock != null ? (
                      <span className="text-[11px] text-muted-foreground">Stock: {p.stock}</span>
                    ) : null}
                  </div>
                  {puedeEditar ? (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      title="Editar producto"
                      className="rounded-md border border-border p-1.5 text-stone-500 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 dark:text-muted-foreground"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Paginación */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {data.total} producto{data.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden /> Anterior
            </Button>
            <span className="tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Siguiente <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
