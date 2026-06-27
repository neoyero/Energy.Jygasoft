"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Search, Tags, X } from "lucide-react"

import type {
  ProductoRecord,
  ProductosFiltros,
  ProductoTipoRecord,
} from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ProductosTable } from "@/components/admin/productos/productos-table"
import { ProductoForm } from "@/components/admin/productos/producto-form"
import { ProductoTiposPanel } from "@/components/admin/productos/producto-tipos-panel"

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

type Pestania = "productos" | "tipos"

export interface ProductosViewProps {
  tipos: ReadonlyArray<ProductoTipoRecord>
  /** RBAC productos:edit. */
  puedeEditar: boolean
  /** Solo admin puede borrar productos. */
  puedeEliminar: boolean
}

/**
 * Contenedor cliente del módulo Productos. Gestiona la pestaña activa
 * (productos / tipos), los filtros (tipo + búsqueda con debounce), el alta y la
 * edición. La tabla trae los datos del servidor (paginación); reloadToken la
 * fuerza a recargar tras crear o editar.
 */
export function ProductosView({ tipos, puedeEditar, puedeEliminar }: ProductosViewProps) {
  const [pestania, setPestania] = useState<Pestania>("productos")
  const [tipoId, setTipoId] = useState<string>("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<ProductoRecord | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Debounce de la búsqueda (250 ms).
  useEffect(() => {
    const timer = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(timer)
  }, [busqueda])

  const filtros: ProductosFiltros = useMemo(
    () => ({
      productoTipoId: tipoId || undefined,
      busqueda: busquedaEf.trim() || undefined,
    }),
    [tipoId, busquedaEf],
  )

  // Tipos activos para el formulario (no se ofrecen tipos desactivados al crear).
  const tiposActivos = useMemo(
    () => tipos.filter((t) => t.activo).map((t) => ({ id: t.id, nombre: t.nombre, clave: t.clave })),
    [tipos],
  )

  function trasGuardar(): void {
    setCreando(false)
    setEditando(null)
    setReloadToken((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pestañas */}
      <div
        className="inline-flex w-fit rounded-lg border border-stone-200 p-0.5 dark:border-border"
        role="tablist"
      >
        <BotonPestania activo={pestania === "productos"} onClick={() => setPestania("productos")}>
          Productos
        </BotonPestania>
        <BotonPestania activo={pestania === "tipos"} onClick={() => setPestania("tipos")}>
          <Tags className="size-4" aria-hidden /> Tipos
        </BotonPestania>
      </div>

      {pestania === "productos" ? (
        <>
          {/* Filtros + acciones */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="filtro-tipo" className="block text-xs font-medium text-muted-foreground">
                  Tipo
                </label>
                <select
                  id="filtro-tipo"
                  value={tipoId}
                  onChange={(e) => setTipoId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Todos los tipos</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.productos})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="filtro-busqueda" className="block text-xs font-medium text-muted-foreground">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="filtro-busqueda"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre, SKU o marca…"
                    className="w-64 pl-8"
                  />
                </div>
              </div>
            </div>

            {puedeEditar ? (
              <Button
                type="button"
                size="sm"
                variant={creando ? "outline" : "default"}
                onClick={() => {
                  setEditando(null)
                  setCreando((p) => !p)
                }}
                disabled={tiposActivos.length === 0}
                title={tiposActivos.length === 0 ? "Crea un tipo activo primero" : undefined}
              >
                {creando ? (
                  <>
                    <X className="size-4" aria-hidden /> Cerrar
                  </>
                ) : (
                  <>
                    <Plus className="size-4" aria-hidden /> Nuevo producto
                  </>
                )}
              </Button>
            ) : null}
          </div>

          {/* Form de alta */}
          {puedeEditar && creando ? (
            <ProductoForm modo="crear" tipos={tiposActivos} onSuccess={trasGuardar} />
          ) : null}

          {/* Form de edición */}
          {puedeEditar && editando ? (
            <ProductoForm
              modo="editar"
              producto={editando}
              tipos={tiposActivos}
              onSuccess={trasGuardar}
            />
          ) : null}

          <ProductosTable
            filtros={filtros}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
            onEdit={(p) => {
              setCreando(false)
              setEditando(p)
            }}
            reloadToken={reloadToken}
          />
        </>
      ) : (
        <ProductoTiposPanel tipos={tipos} puedeEditar={puedeEditar} />
      )}
    </div>
  )
}

function BotonPestania({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        activo
          ? "bg-brand text-white dark:bg-primary dark:text-primary-foreground"
          : "text-stone-500 hover:bg-stone-100 dark:text-muted-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
