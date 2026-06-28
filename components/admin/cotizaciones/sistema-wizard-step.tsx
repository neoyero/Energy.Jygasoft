"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Calculator, Sparkles } from "lucide-react"

import { esquemaCfe } from "@/db/schema"
import { TARIFAS_CFE } from "@/lib/cfe/tarifas"
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

/** Tarifas CFE: opción vacía + catálogo compartido (lib/cfe/tarifas). */
const TARIFAS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Sin especificar" },
  ...TARIFAS_CFE,
]

/** Capacidad (kWp) por encima de la cual avisamos posible error de captura. */
const KWP_SOSPECHOSO = 150

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
  /** Consumo TAL CUAL aparece en el recibo (del período). */
  consumoPeriodo: string
  /** Período del recibo: mensual o bimestral (CFE residencial suele ser bimestral). */
  periodo: "mensual" | "bimestral"
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
  // El consumo del contexto (lead) ya es MENSUAL → período "mensual".
  return {
    consumoPeriodo: numStr(calcContext?.consumoKwhMes),
    periodo: "mensual",
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

  // Consumo mensual derivado del período (para mostrar y enviar).
  const consumoMensual = (() => {
    const n = nullableNum(form.consumoPeriodo)
    if (n === null) return null
    return form.periodo === "bimestral" ? n / 2 : n
  })()

  function onCalcular(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const usarCapacidad = form.usarCapacidad

    // Validaciones antes de llamar al servidor (UX a prueba de errores).
    if (usarCapacidad) {
      const kwp = nullableNum(form.capacidadKwpObjetivo)
      if (kwp === null || kwp <= 0) {
        setError("Captura la capacidad objetivo en kWp (p. ej. 5).")
        return
      }
      if (kwp > KWP_SOSPECHOSO) {
        setError(
          `Una capacidad de ${kwp} kWp es inusualmente alta. ¿Quisiste capturar el CONSUMO (kWh)? Desactiva "capacidad objetivo" y usa el consumo del recibo.`,
        )
        return
      }
    } else {
      const recibo = nullableNum(form.reciboMxn)
      if (consumoMensual === null && recibo === null) {
        setError(
          "Captura el consumo del recibo (kWh) o el importe del recibo (MXN).",
        )
        return
      }
    }

    const input = {
      cotizacionId,
      // Si se usa capacidad objetivo se ignora consumo/recibo.
      consumoKwhMes: usarCapacidad ? null : consumoMensual,
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
        {!form.usarCapacidad ? (
          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del recibo CFE
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="wizard-consumo">Consumo del período (kWh)</Label>
                <Input
                  id="wizard-consumo"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.consumoPeriodo}
                  onChange={(e) => set("consumoPeriodo", e.target.value)}
                  disabled={busy}
                  placeholder="p. ej. 516"
                />
                <p className="text-xs text-muted-foreground">
                  El “Total período (kWh)” de tu recibo.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wizard-periodo">Período del recibo</Label>
                <select
                  id="wizard-periodo"
                  value={form.periodo}
                  onChange={(e) =>
                    set("periodo", e.target.value as InsumosState["periodo"])
                  }
                  disabled={busy}
                  className={SELECT_CLASS}
                >
                  <option value="bimestral">Bimestral (2 meses)</option>
                  <option value="mensual">Mensual (1 mes)</option>
                </select>
                {consumoMensual !== null ? (
                  <p className="text-xs text-muted-foreground">
                    ≈ {Math.round(consumoMensual)} kWh/mes
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wizard-tarifa">Tarifa</Label>
                <select
                  id="wizard-tarifa"
                  value={form.tarifa}
                  onChange={(e) => set("tarifa", e.target.value)}
                  disabled={busy}
                  className={SELECT_CLASS}
                >
                  {TARIFAS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="wizard-recibo">Importe del recibo (MXN)</Label>
              <Input
                id="wizard-recibo"
                type="number"
                step="any"
                inputMode="decimal"
                value={form.reciboMxn}
                onChange={(e) => set("reciboMxn", e.target.value)}
                disabled={busy}
                placeholder="Opcional"
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Se usa solo si no capturas el consumo.
              </p>
            </div>
          </fieldset>
        ) : (
          <fieldset className="space-y-3 rounded-lg border border-amber-300/60 bg-amber-50/40 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Modo avanzado · capacidad objetivo
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="wizard-capacidad">Capacidad (kWp)</Label>
                <Input
                  id="wizard-capacidad"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.capacidadKwpObjetivo}
                  onChange={(e) => set("capacidadKwpObjetivo", e.target.value)}
                  disabled={busy}
                  placeholder="p. ej. 5"
                />
                <p className="text-xs text-muted-foreground">
                  Tamaño del sistema, <strong>no</strong> el consumo en kWh.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wizard-tarifa-cap">Tarifa</Label>
                <select
                  id="wizard-tarifa-cap"
                  value={form.tarifa}
                  onChange={(e) => set("tarifa", e.target.value)}
                  disabled={busy}
                  className={SELECT_CLASS}
                >
                  {TARIFAS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        )}

        {/* Esquema + moneda (aplican a la cabecera) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Toggle modo avanzado (capacidad objetivo) */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.usarCapacidad}
            onChange={(e) => set("usarCapacidad", e.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-brand-green"
          />
          Dimensionar por capacidad objetivo (kWp)
          <span className="text-xs text-muted-foreground">
            (avanzado — ignora el consumo del recibo)
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
