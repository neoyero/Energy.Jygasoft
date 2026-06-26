"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Calculator, Sparkles } from "lucide-react"

import { esquemaCfe } from "@/db/schema"
import {
  calcularDimensionamiento,
  aplicarDimensionamiento,
} from "@/lib/admin/actions"
import type {
  CotizacionDetalleCabecera,
  CotizacionCalcContext,
  EsquemaCfe,
} from "@/lib/admin/queries"
import type { DimensionarResult } from "@/lib/admin/cotizacion-dimensionado"
import { labelFor } from "@/components/admin/ui/status-badge"
import { ConfirmButton } from "@/components/admin/ui/confirm-button"
import { PreviewDimensionamiento } from "@/components/admin/cotizaciones/preview-dimensionamiento"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const ESQUEMAS = esquemaCfe.enumValues

const MONEDA_DEFAULT = "MXN"

export interface SistemaWizardStepProps {
  cotizacionId: string
  cabecera: CotizacionDetalleCabecera
  /** Contexto tecnico detectado (prefill de consumo/recibo/tarifa). */
  calcContext: CotizacionCalcContext | null
  itemsCount: number
  /** RBAC cotizaciones:edit -> habilita el wizard. */
  puedeEditar: boolean
}

/** Estado interno del form de insumos: strings controlados. */
interface InsumosState {
  consumoKwhMes: string
  reciboMxn: string
  capacidadKwpObjetivo: string
  usarCapacidad: boolean
  tarifa: string
  esquema: string
  moneda: string
}

/** number | null -> string para inputs controlados (null/undefined -> ""). */
function numStr(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v)
}

/** "" -> null; en otro caso parsea Number (NaN -> null). */
function nullableNum(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "" -> null para overrides opcionales de texto. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Construye el estado inicial precargando contexto + cabecera. */
function estadoInicial(
  cabecera: CotizacionDetalleCabecera,
  calcContext: CotizacionCalcContext | null,
): InsumosState {
  return {
    consumoKwhMes: numStr(calcContext?.consumoKwhMes),
    reciboMxn: numStr(calcContext?.reciboMxn),
    capacidadKwpObjetivo: "",
    usarCapacidad: false,
    tarifa: calcContext?.tarifa ?? "",
    esquema: cabecera.esquema ?? "",
    moneda: cabecera.moneda || MONEDA_DEFAULT,
  }
}

/**
 * Paso "Sistema inteligente" del wizard de cotizacion. Captura los insumos
 * (consumo / recibo / tarifa o, alternativamente, una capacidad objetivo en
 * kWp), llama a calcularDimensionamiento para producir un PREVIEW editable y,
 * tras revisarlo, aplica la propuesta con aplicarDimensionamiento (reemplazando
 * las partidas actuales). Ambos pasos usan useTransition y muestran errores
 * inline. Sin permiso de edicion solo se muestra texto informativo.
 */
export function SistemaWizardStep({
  cotizacionId,
  cabecera,
  calcContext,
  itemsCount,
  puedeEditar,
}: SistemaWizardStepProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aplicando, startAplicando] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [aplicarError, setAplicarError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DimensionarResult | null>(null)
  const [form, setForm] = useState<InsumosState>(() =>
    estadoInicial(cabecera, calcContext),
  )

  // Parche inmutable de un campo del form.
  function set<K extends keyof InsumosState>(
    key: K,
    value: InsumosState[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onCalcular(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const usarCapacidad = form.usarCapacidad
    const input = {
      cotizacionId,
      // Si se usa capacidad objetivo se ignora consumo/recibo.
      consumoKwhMes: usarCapacidad ? null : nullableNum(form.consumoKwhMes),
      reciboMxn: usarCapacidad ? null : nullableNum(form.reciboMxn),
      capacidadKwpObjetivo: usarCapacidad
        ? nullableNum(form.capacidadKwpObjetivo)
        : null,
      tarifa: nullable(form.tarifa),
      modelo: "A" as const,
    }

    startTransition(async () => {
      const res = await calcularDimensionamiento(input)
      if (!res.ok || !res.preview) {
        setError(res.ok ? "No se pudo generar la propuesta." : res.error)
        return
      }
      setPreview(res.preview)
      setAplicarError(null)
    })
  }

  function onAplicar(): void {
    if (!preview) return
    setAplicarError(null)

    const esquema = (nullable(form.esquema) as EsquemaCfe | null) ?? null
    const moneda =
      form.moneda.trim() === "" ? MONEDA_DEFAULT : form.moneda.trim()

    const input = {
      cotizacionId,
      sistema: {
        ...preview.sistema,
        esquema,
        moneda,
      },
      partidas: preview.partidas.map((p) => ({
        equipoId: p.equipoId,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
      })),
      modo: "reemplazar" as const,
    }

    startAplicando(async () => {
      const res = await aplicarDimensionamiento(input)
      if (!res.ok) {
        setAplicarError(res.error)
        return
      }
      router.refresh()
    })
  }

  // Sin permiso de edicion: solo texto informativo.
  if (!puedeEditar) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No tienes permiso para dimensionar esta cotizacion. Contacta a un
        administrador si necesitas editar el sistema y las partidas.
      </div>
    )
  }

  const busy = pending || aplicando

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          Dimensionamiento inteligente
        </h3>
      </div>

      {/* Form de insumos */}
      <form onSubmit={onCalcular} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!form.usarCapacidad ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wizard-consumo">Consumo (kWh/mes)</Label>
                <Input
                  id="wizard-consumo"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.consumoKwhMes}
                  onChange={(e) => set("consumoKwhMes", e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wizard-recibo">Recibo (MXN)</Label>
                <Input
                  id="wizard-recibo"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.reciboMxn}
                  onChange={(e) => set("reciboMxn", e.target.value)}
                  disabled={busy}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="wizard-capacidad">
                Capacidad objetivo (kWp)
              </Label>
              <Input
                id="wizard-capacidad"
                type="number"
                step="any"
                inputMode="decimal"
                value={form.capacidadKwpObjetivo}
                onChange={(e) => set("capacidadKwpObjetivo", e.target.value)}
                disabled={busy}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wizard-tarifa">Tarifa</Label>
            <Input
              id="wizard-tarifa"
              value={form.tarifa}
              onChange={(e) => set("tarifa", e.target.value)}
              disabled={busy}
              placeholder="Sin especificar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wizard-esquema">Esquema CFE</Label>
            <select
              id="wizard-esquema"
              value={form.esquema}
              onChange={(e) => set("esquema", e.target.value)}
              disabled={busy}
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
            <Label htmlFor="wizard-moneda">Moneda</Label>
            <Input
              id="wizard-moneda"
              value={form.moneda}
              onChange={(e) => set("moneda", e.target.value)}
              disabled={busy}
              placeholder={MONEDA_DEFAULT}
            />
          </div>
        </div>

        {/* Toggle capacidad objetivo */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.usarCapacidad}
            onChange={(e) => set("usarCapacidad", e.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-brand-green"
          />
          Usar capacidad objetivo (kWp)
          <span className="text-xs text-muted-foreground">
            (ignora consumo y recibo)
          </span>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            <Calculator className="size-4" aria-hidden />
            {pending ? "Calculando…" : "Calcular"}
          </Button>
          {error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : null}
        </div>
      </form>

      {/* Preview editable + aplicar */}
      {preview ? (
        <div className="space-y-4 border-t border-border pt-4">
          <PreviewDimensionamiento preview={preview} onChange={setPreview} />

          <div className="flex flex-wrap items-center gap-3">
            {itemsCount > 0 ? (
              <ConfirmButton
                size="sm"
                disabled={busy}
                onConfirm={onAplicar}
                title="Aplicar dimensionamiento"
                description="Se reemplazaran las partidas actuales de la cotizacion por las de esta propuesta. Esta accion no se puede deshacer."
                confirmLabel={aplicando ? "Aplicando…" : "Aplicar"}
              >
                Aplicar a la cotizacion
              </ConfirmButton>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onAplicar}
              >
                {aplicando ? "Aplicando…" : "Aplicar a la cotizacion"}
              </Button>
            )}
            {aplicarError ? (
              <span className="text-sm text-destructive">{aplicarError}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
