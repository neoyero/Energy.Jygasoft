"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, X } from "lucide-react"

import { esquemaCfe } from "@/db/schema"
import { actualizarCotizacionDatos } from "@/lib/admin/actions"
import type { CotizacionDetalleCabecera, EsquemaCfe } from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const FIELDSET_CLASS =
  "grid gap-4 rounded-lg border border-border p-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3"

const LEGEND_CLASS =
  "px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"

const ESQUEMAS = esquemaCfe.enumValues

const MONEDA_DEFAULT = "MXN"

export interface SistemaFormProps {
  cotizacionId: string
  datos: CotizacionDetalleCabecera
  /** RBAC cotizaciones:edit -> habilita la edicion. */
  puedeEditar: boolean
  /** Callback opcional tras guardar con exito (ej. plegar el form). */
  onSuccess?: () => void
}

/** Estado interno del form: strings controlados (los vacios -> null al enviar). */
interface FormState {
  capacidadKwp: string
  paneles: string
  inversor: string
  produccionAnualKwh: string
  ahorroAnualMxn: string
  paybackAnios: string
  esquema: string
  moneda: string
  validaHasta: string
}

/** number | null -> string para inputs controlados (null/undefined -> ""). */
function numStr(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v)
}

/** Construye el estado inicial a partir de los datos de cabecera. */
function estadoInicial(datos: CotizacionDetalleCabecera): FormState {
  return {
    capacidadKwp: numStr(datos.capacidadKwp),
    paneles: numStr(datos.paneles),
    inversor: datos.inversor ?? "",
    produccionAnualKwh: numStr(datos.produccionAnualKwh),
    ahorroAnualMxn: numStr(datos.ahorroAnualMxn),
    paybackAnios: numStr(datos.paybackAnios),
    esquema: datos.esquema ?? "",
    moneda: datos.moneda ?? MONEDA_DEFAULT,
    validaHasta: datos.validaHasta ?? "",
  }
}

/** "" -> null; en otro caso parsea Number (NaN -> null). */
function nullableNum(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "" -> null para columnas opcionales de texto/fecha. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Formulario controlado de edicion de los datos de cabecera/sistema de una
 * cotizacion (sizing, produccion, ahorro, payback, esquema CFE, moneda y
 * vigencia). Plegable: un boton "Editar datos" despliega el form; "Cancelar" /
 * "Cerrar" lo oculta. Llama a actualizarCotizacionDatos dentro de useTransition
 * y maneja el ActionResult. Al exito refresca la ruta (router.refresh) e invoca
 * onSuccess. Autocontenido: el builder decide donde montarlo.
 */
export function SistemaForm({
  cotizacionId,
  datos,
  puedeEditar,
  onSuccess,
}: SistemaFormProps) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(datos))

  // Parche inmutable de un campo del form.
  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Cierra el form descartando cambios no guardados (re-precarga desde datos).
  function cerrar(): void {
    setForm(estadoInicial(datos))
    setError(null)
    setEditando(false)
    onSuccess?.()
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload = {
      capacidadKwp: nullableNum(form.capacidadKwp),
      paneles: nullableNum(form.paneles),
      inversor: nullable(form.inversor),
      produccionAnualKwh: nullableNum(form.produccionAnualKwh),
      ahorroAnualMxn: nullableNum(form.ahorroAnualMxn),
      paybackAnios: nullableNum(form.paybackAnios),
      esquema: (nullable(form.esquema) as EsquemaCfe | null),
      // Moneda nunca null: vacio -> default "MXN".
      moneda: form.moneda.trim() === "" ? MONEDA_DEFAULT : form.moneda.trim(),
      validaHasta: nullable(form.validaHasta),
    }

    startTransition(async () => {
      const res = await actualizarCotizacionDatos(cotizacionId, payload)

      if (!res.ok) {
        setError(res.error)
        return
      }

      router.refresh()
      cerrar()
    })
  }

  // Sin permiso de edicion: no se renderiza ningun control.
  if (!puedeEditar) return null

  // Plegado: solo el boton para desplegar el form.
  if (!editando) {
    return (
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={() => setEditando(true)}
      >
        <Pencil className="size-4" aria-hidden />
        Editar datos
      </Button>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Sistema */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Sistema</legend>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-capacidad">Capacidad (kWp)</Label>
          <Input
            id="sistema-capacidad"
            type="number"
            step="any"
            inputMode="decimal"
            value={form.capacidadKwp}
            onChange={(e) => set("capacidadKwp", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-paneles">Paneles</Label>
          <Input
            id="sistema-paneles"
            type="number"
            step="1"
            inputMode="numeric"
            value={form.paneles}
            onChange={(e) => set("paneles", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-inversor">Inversor</Label>
          <Input
            id="sistema-inversor"
            value={form.inversor}
            onChange={(e) => set("inversor", e.target.value)}
            disabled={pending}
          />
        </div>
      </fieldset>

      {/* Resultados */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Resultados</legend>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-produccion">Produccion anual (kWh)</Label>
          <Input
            id="sistema-produccion"
            type="number"
            step="any"
            inputMode="decimal"
            value={form.produccionAnualKwh}
            onChange={(e) => set("produccionAnualKwh", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-ahorro">Ahorro anual (MXN)</Label>
          <Input
            id="sistema-ahorro"
            type="number"
            step="any"
            inputMode="decimal"
            value={form.ahorroAnualMxn}
            onChange={(e) => set("ahorroAnualMxn", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-payback">Payback (anios)</Label>
          <Input
            id="sistema-payback"
            type="number"
            step="any"
            inputMode="decimal"
            value={form.paybackAnios}
            onChange={(e) => set("paybackAnios", e.target.value)}
            disabled={pending}
          />
        </div>
      </fieldset>

      {/* Comercial */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Comercial</legend>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-esquema">Esquema CFE</Label>
          <select
            id="sistema-esquema"
            value={form.esquema}
            onChange={(e) => set("esquema", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin especificar</option>
            {ESQUEMAS.map((es) => (
              <option key={es} value={es}>
                {labelFor(es)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-moneda">Moneda</Label>
          <Input
            id="sistema-moneda"
            value={form.moneda}
            onChange={(e) => set("moneda", e.target.value)}
            disabled={pending}
            placeholder={MONEDA_DEFAULT}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sistema-valida">Valida hasta</Label>
          <Input
            id="sistema-valida"
            type="date"
            value={form.validaHasta}
            onChange={(e) => set("validaHasta", e.target.value)}
            disabled={pending}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={cerrar}
        >
          <X className="size-4" aria-hidden />
          Cancelar
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  )
}
