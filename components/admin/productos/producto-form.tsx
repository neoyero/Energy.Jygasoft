"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearProducto, actualizarProducto } from "@/lib/admin/actions"
import type { ProductoRecord, ProductoTipoOption } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { atributosDeTipo } from "@/components/admin/productos/producto-atributos"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

/** Payload tal cual lo esperan las server actions (z.input del schema). */
type ProductoInput = Parameters<typeof crearProducto>[0]

export interface ProductoFormProps {
  modo: "crear" | "editar"
  /** Registro a precargar (obligatorio en modo "editar"). */
  producto?: ProductoRecord
  /** Tipos activos para el select. */
  tipos: ReadonlyArray<ProductoTipoOption>
  onSuccess?: () => void
}

/** "" -> null para columnas opcionales de texto. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** "" -> null; texto numérico -> number (rechaza no-numéricos). */
function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Convierte un valor de atributo de string a number cuando es numérico. */
function coerceAtributo(raw: string): string | number {
  const t = raw.trim()
  const n = Number(t)
  return Number.isFinite(n) ? n : t
}

interface FormState {
  productoTipoId: string
  sku: string
  nombre: string
  marca: string
  modelo: string
  descripcion: string
  unidad: string
  precioCompra: string
  precioVenta: string
  moneda: string
  stock: string
  activo: boolean
}

/**
 * Separa los atributos en campos editables (primitivos -> string) y preservados
 * (objetos/null que no se editan en el formulario pero no deben perderse).
 */
function partirAtributos(at: Record<string, unknown>): {
  campos: Record<string, string>
  preservados: Record<string, unknown>
} {
  const campos: Record<string, string> = {}
  const preservados: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(at)) {
    if (v === null || typeof v === "object") preservados[k] = v
    else campos[k] = String(v)
  }
  return { campos, preservados }
}

function estadoInicial(p?: ProductoRecord, tipos?: ReadonlyArray<ProductoTipoOption>): FormState {
  return {
    productoTipoId: p?.productoTipoId ?? tipos?.[0]?.id ?? "",
    sku: p?.sku ?? "",
    nombre: p?.nombre ?? "",
    marca: p?.marca ?? "",
    modelo: p?.modelo ?? "",
    descripcion: p?.descripcion ?? "",
    unidad: p?.unidad ?? "pieza",
    precioCompra: p?.precioCompra != null ? String(p.precioCompra) : "",
    precioVenta: p?.precioVenta != null ? String(p.precioVenta) : "",
    moneda: p?.moneda ?? "MXN",
    stock: p?.stock != null ? String(p.stock) : "",
    activo: p?.activo ?? true,
  }
}

/**
 * Formulario controlado de alta/edición de producto. El `<select>` de tipo
 * decide qué campos de `atributos` se muestran (definidos en producto-atributos).
 * Los atributos heredados no editables se preservan. Llama a crearProducto /
 * actualizarProducto en useTransition y, al éxito, refresca la ruta.
 */
export function ProductoForm({ modo, producto, tipos, onSuccess }: ProductoFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(producto, tipos))

  const inicialAtributos = useMemo(
    () => partirAtributos(producto?.atributos ?? {}),
    [producto],
  )
  const [atributos, setAtributos] = useState<Record<string, string>>(
    inicialAtributos.campos,
  )

  // Campos de atributos del tipo seleccionado.
  const tipoSel = tipos.find((t) => t.id === form.productoTipoId)
  const campos = atributosDeTipo(tipoSel?.clave)

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setAtributo(key: string, value: string): void {
    setAtributos((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    // Reconstruye atributos: preservados + campos no vacíos (coercionados).
    const atributosFinal: Record<string, unknown> = { ...inicialAtributos.preservados }
    for (const [k, raw] of Object.entries(atributos)) {
      if (raw.trim() === "") continue
      atributosFinal[k] = coerceAtributo(raw)
    }

    const payload: ProductoInput = {
      productoTipoId: form.productoTipoId,
      sku: nullable(form.sku),
      nombre: form.nombre.trim(),
      marca: nullable(form.marca),
      modelo: nullable(form.modelo),
      descripcion: nullable(form.descripcion),
      unidad: form.unidad.trim() || "pieza",
      precioCompra: numOrNull(form.precioCompra),
      precioVenta: numOrNull(form.precioVenta),
      moneda: form.moneda.trim().toUpperCase() || "MXN",
      stock: numOrNull(form.stock),
      activo: form.activo,
      atributos: atributosFinal,
    }

    startTransition(async () => {
      const res =
        modo === "editar" && producto
          ? await actualizarProducto(producto.id, payload)
          : await crearProducto(payload)

      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
      onSuccess?.()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Tipo + identificación */}
      <div className="space-y-1.5">
        <Label htmlFor="prod-tipo">Tipo</Label>
        <select
          id="prod-tipo"
          value={form.productoTipoId}
          onChange={(e) => set("productoTipoId", e.target.value)}
          disabled={pending}
          required
          className={SELECT_CLASS}
        >
          {tipos.length === 0 ? <option value="">Sin tipos</option> : null}
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="prod-nombre">Nombre</Label>
        <Input
          id="prod-nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          disabled={pending}
          placeholder="Nombre del producto"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-sku">SKU / Código</Label>
        <Input
          id="prod-sku"
          value={form.sku}
          onChange={(e) => set("sku", e.target.value)}
          disabled={pending}
          placeholder="Opcional, único"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-marca">Marca</Label>
        <Input
          id="prod-marca"
          value={form.marca}
          onChange={(e) => set("marca", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-modelo">Modelo</Label>
        <Input
          id="prod-modelo"
          value={form.modelo}
          onChange={(e) => set("modelo", e.target.value)}
          disabled={pending}
        />
      </div>

      {/* Precios y stock */}
      <div className="space-y-1.5">
        <Label htmlFor="prod-precio-compra">Precio compra</Label>
        <Input
          id="prod-precio-compra"
          value={form.precioCompra}
          onChange={(e) => set("precioCompra", e.target.value)}
          disabled={pending}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-precio-venta">Precio venta</Label>
        <Input
          id="prod-precio-venta"
          value={form.precioVenta}
          onChange={(e) => set("precioVenta", e.target.value)}
          disabled={pending}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-moneda">Moneda</Label>
        <Input
          id="prod-moneda"
          value={form.moneda}
          onChange={(e) => set("moneda", e.target.value)}
          disabled={pending}
          maxLength={3}
          placeholder="MXN"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-unidad">Unidad</Label>
        <Input
          id="prod-unidad"
          value={form.unidad}
          onChange={(e) => set("unidad", e.target.value)}
          disabled={pending}
          placeholder="pieza, metro, kit…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prod-stock">Stock</Label>
        <Input
          id="prod-stock"
          value={form.stock}
          onChange={(e) => set("stock", e.target.value)}
          disabled={pending}
          inputMode="numeric"
          placeholder="Opcional"
        />
      </div>

      {/* Atributos dinámicos según el tipo */}
      {campos.length > 0 ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Atributos de {tipoSel?.nombre}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campos.map((campo) => (
              <div key={campo.key} className="space-y-1.5">
                <Label htmlFor={`prod-attr-${campo.key}`}>
                  {campo.label}
                  {campo.sufijo ? (
                    <span className="ml-1 text-muted-foreground">({campo.sufijo})</span>
                  ) : null}
                </Label>
                <Input
                  id={`prod-attr-${campo.key}`}
                  value={atributos[campo.key] ?? ""}
                  onChange={(e) => setAtributo(campo.key, e.target.value)}
                  disabled={pending}
                  inputMode={campo.tipo === "number" ? "decimal" : undefined}
                  placeholder={campo.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Descripción */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="prod-descripcion">Descripción</Label>
        <textarea
          id="prod-descripcion"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2 lg:col-span-3">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => set("activo", e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Activo (disponible para cotizar)
      </label>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Guardando…"
            : modo === "editar"
              ? "Guardar cambios"
              : "Crear producto"}
        </Button>
        {onSuccess ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onSuccess}
          >
            Cancelar
          </Button>
        ) : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  )
}
