"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, RefreshCw, AlertTriangle, Save } from "lucide-react"

import { guardarPaqueteLineas } from "@/lib/admin/actions"
import type { PaqueteLineaRow, ProductoCatalogoOpcion } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/admin/ui/card"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

interface LineaEdit {
  key: string
  productoId: string
  descripcion: string
  cantidad: string
  precioFijo: string
}

export interface PaqueteLineasEditorProps {
  paqueteId: string
  lineasIniciales: ReadonlyArray<PaqueteLineaRow>
  catalogo: ReadonlyArray<ProductoCatalogoOpcion>
  moneda: string
  puedeEditar: boolean
}

function fmtMxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Editor de líneas de un paquete: elige productos/servicios del catálogo, define
 * cantidad y precio_fijo (snapshot). Muestra el precio de venta actual como
 * referencia y avisa si el precio_fijo difiere (con botón «usar precio actual»).
 * Guarda con guardarPaqueteLineas. Solo lectura si el rol no puede editar.
 */
export function PaqueteLineasEditor({
  paqueteId,
  lineasIniciales,
  catalogo,
  moneda,
  puedeEditar,
}: PaqueteLineasEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const counter = useRef(0)
  const nextKey = () => `l${counter.current++}`

  const [lineas, setLineas] = useState<LineaEdit[]>(() =>
    lineasIniciales.map((l) => ({
      key: nextKey(),
      productoId: l.productoId,
      descripcion: l.descripcion ?? l.productoNombre,
      cantidad: String(l.cantidad),
      precioFijo: String(l.precioFijo),
    })),
  )

  // precio de venta vivo por producto (referencia para la desviación).
  const precioVivo = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const o of catalogo) m.set(o.id, o.precioVenta)
    // fallback: precio vivo que vino del servidor para productos fuera del catálogo activo.
    for (const l of lineasIniciales) if (!m.has(l.productoId)) m.set(l.productoId, l.precioVentaActual)
    return m
  }, [catalogo, lineasIniciales])

  const total = lineas.reduce((acc, l) => acc + num(l.cantidad) * num(l.precioFijo), 0)

  function set(key: string, patch: Partial<LineaEdit>): void {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function onSelectProducto(key: string, productoId: string): void {
    const o = catalogo.find((c) => c.id === productoId)
    set(key, {
      productoId,
      descripcion: o?.nombre ?? "",
      precioFijo: o?.precioVenta != null ? String(o.precioVenta) : "0",
    })
  }

  function agregar(): void {
    setLineas((prev) => [
      ...prev,
      { key: nextKey(), productoId: "", descripcion: "", cantidad: "1", precioFijo: "0" },
    ])
  }

  function quitar(key: string): void {
    setLineas((prev) => prev.filter((l) => l.key !== key))
  }

  function usarPrecioActual(key: string): void {
    const l = lineas.find((x) => x.key === key)
    if (!l) return
    const vivo = precioVivo.get(l.productoId)
    if (vivo != null) set(key, { precioFijo: String(vivo) })
  }

  function actualizarTodos(): void {
    setLineas((prev) =>
      prev.map((l) => {
        const vivo = precioVivo.get(l.productoId)
        return vivo != null ? { ...l, precioFijo: String(vivo) } : l
      }),
    )
  }

  function guardar(): void {
    setError(null)
    setOkMsg(null)
    const validas = lineas.filter((l) => l.productoId)
    if (validas.some((l) => num(l.cantidad) <= 0)) {
      setError("Todas las líneas deben tener cantidad mayor a 0.")
      return
    }
    startTransition(async () => {
      const res = await guardarPaqueteLineas(
        paqueteId,
        validas.map((l) => ({
          productoId: l.productoId,
          descripcion: l.descripcion.trim() || null,
          cantidad: num(l.cantidad),
          precioFijo: num(l.precioFijo),
        })),
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOkMsg("Líneas guardadas.")
      router.refresh()
    })
  }

  const hayDesviacion = lineas.some((l) => {
    const vivo = precioVivo.get(l.productoId)
    return vivo != null && vivo !== num(l.precioFijo)
  })

  // ── Solo lectura ──────────────────────────────────────────────────────────
  if (!puedeEditar) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Producto / Servicio</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 text-right font-medium">Precio fijo</th>
                  <th className="px-2 py-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {lineasIniciales.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">{l.descripcion ?? l.productoNombre}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.cantidad}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtMxn(l.precioFijo)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtMxn(l.cantidad * l.precioFijo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-sm font-medium">Total: {fmtMxn(total)} {moneda}</p>
        </CardContent>
      </Card>
    )
  }

  // ── Edición ───────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Líneas del paquete</h2>
          {hayDesviacion ? (
            <button
              type="button"
              onClick={actualizarTodos}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <RefreshCw className="size-3.5" aria-hidden /> Actualizar todos al precio actual
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Producto / Servicio</th>
                <th className="w-20 px-2 py-2 text-right font-medium">Cantidad</th>
                <th className="w-40 px-2 py-2 text-right font-medium">Precio fijo</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Importe</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const vivo = precioVivo.get(l.productoId)
                const desviado = vivo != null && vivo !== num(l.precioFijo)
                return (
                  <tr key={l.key} className="border-b border-border last:border-0 align-top">
                    <td className="px-2 py-2">
                      <select
                        value={l.productoId}
                        onChange={(e) => onSelectProducto(l.key, e.target.value)}
                        disabled={pending}
                        className={SELECT_CLASS}
                      >
                        <option value="">— Elegir del catálogo —</option>
                        {catalogo.map((o) => (
                          <option key={o.id} value={o.id}>
                            [{o.tipoNombre}] {o.nombre}
                            {o.naturaleza === "servicio" ? " (servicio)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={l.cantidad}
                        onChange={(e) => set(l.key, { cantidad: e.target.value })}
                        disabled={pending}
                        inputMode="decimal"
                        className="text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={l.precioFijo}
                        onChange={(e) => set(l.key, { precioFijo: e.target.value })}
                        disabled={pending}
                        inputMode="decimal"
                        className="text-right"
                      />
                      {desviado ? (
                        <button
                          type="button"
                          onClick={() => usarPrecioActual(l.key)}
                          disabled={pending}
                          title="Usar el precio de venta actual"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
                        >
                          <AlertTriangle className="size-3" aria-hidden /> actual {fmtMxn(vivo!)}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtMxn(num(l.cantidad) * num(l.precioFijo))}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => quitar(l.key)}
                        disabled={pending}
                        title="Quitar línea"
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Sin líneas. Agrega productos o servicios del catálogo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" size="sm" variant="outline" onClick={agregar} disabled={pending}>
            <Plus className="size-4" aria-hidden /> Agregar línea
          </Button>
          <p className="text-sm font-medium tabular-nums">Total: {fmtMxn(total)} {moneda}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Button type="button" size="sm" onClick={guardar} disabled={pending}>
            <Save className="size-4" aria-hidden /> {pending ? "Guardando…" : "Guardar líneas"}
          </Button>
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          {okMsg ? <span className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
