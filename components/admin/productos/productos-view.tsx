"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Search, Tags, Table2, LayoutGrid } from "lucide-react"

import type {
  ProductoRecord,
  ProductosFiltros,
  ProductoTipoRecord,
} from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import { cn } from "@/lib/utils"
import { ProductosTable } from "@/components/admin/productos/productos-table"
import { ProductosGallery } from "@/components/admin/productos/productos-gallery"
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
  const [saving, setSaving] = useState(false)
  const [vista, setVista] = useState<"tabla" | "galeria">("galeria")

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

  /** Cierra el modal sin recargar (cancelar / cerrar). */
  function cerrarFormulario(): void {
    setCreando(false)
    setEditando(null)
  }

  /** Tras guardar con éxito: cierra el modal y fuerza recarga de la tabla. */
  function trasGuardar(): void {
    cerrarFormulario()
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

            <div className="flex items-center gap-2">
              {/* Toggle Tabla / Galería */}
              <div className="inline-flex rounded-lg border border-stone-200 p-0.5 dark:border-border" role="group" aria-label="Cambiar vista">
                <BotonVista activo={vista === "tabla"} onClick={() => setVista("tabla")} label="Tabla">
                  <Table2 className="size-4" aria-hidden />
                </BotonVista>
                <BotonVista activo={vista === "galeria"} onClick={() => setVista("galeria")} label="Galería">
                  <LayoutGrid className="size-4" aria-hidden />
                </BotonVista>
              </div>

              {puedeEditar ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditando(null)
                    setCreando(true)
                  }}
                  disabled={tiposActivos.length === 0}
                  title={tiposActivos.length === 0 ? "Crea un tipo activo primero" : undefined}
                >
                  <Plus className="size-4" aria-hidden /> Nuevo producto
                </Button>
              ) : null}
            </div>
          </div>

          {vista === "tabla" ? (
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
          ) : (
            <ProductosGallery
              filtros={filtros}
              puedeEditar={puedeEditar}
              onEdit={(p) => {
                setCreando(false)
                setEditando(p)
              }}
              reloadToken={reloadToken}
            />
          )}

          {/* Alta / edición en modal (responsive). */}
          {puedeEditar ? (
            <Modal
              open={creando || editando !== null}
              onOpenChange={(abierto) => {
                if (!abierto) cerrarFormulario()
              }}
              title={editando ? "Editar producto" : "Nuevo producto"}
              description={
                editando
                  ? "Modifica los datos del producto."
                  : "Completa los datos del nuevo producto."
              }
              size="3xl"
              dismissable={!saving}
            >
              <ProductoForm
                key={editando?.id ?? "nuevo"}
                modo={editando ? "editar" : "crear"}
                producto={editando ?? undefined}
                tipos={tiposActivos}
                onSuccess={trasGuardar}
                onCancel={cerrarFormulario}
                onSavingChange={setSaving}
              />
            </Modal>
          ) : null}
        </>
      ) : (
        <ProductoTiposPanel tipos={tipos} puedeEditar={puedeEditar} />
      )}
    </div>
  )
}

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
      aria-pressed={activo}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
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
