"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearPago, actualizarPago } from "@/lib/admin/actions"
import type { PagoRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface PagoFormProps {
  modo: "crear" | "editar"
  /** Datos a precargar (obligatorio en modo "editar"). */
  pago?: PagoRow
  /** Callback opcional tras guardar con éxito (ej. cerrar el formulario). */
  onSuccess?: () => void
}

/** Estado interno del form: strings controlados (los vacíos -> null al enviar). */
interface FormState {
  concepto: string
  monto: string
  moneda: string
  fechaProgramada: string
  metodo: string
  proyectoId: string
  cotizacionId: string
}

/** Construye el estado inicial a partir del pago (o vacíos en alta). */
function estadoInicial(pago?: PagoRow): FormState {
  return {
    concepto: pago?.concepto ?? "",
    monto: pago ? String(pago.monto) : "",
    moneda: pago?.moneda ?? "MXN",
    fechaProgramada: pago?.fechaProgramada ?? "",
    metodo: pago?.metodo ?? "",
    proyectoId: pago?.proyectoId ?? "",
    cotizacionId: "",
  }
}

/** "" -> null para campos opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Formulario controlado de alta/edición de pago. Llama a crearPago /
 * actualizarPago dentro de useTransition y maneja el ActionResult. Al éxito
 * refresca la ruta (router.refresh) e invoca onSuccess (cierre del formulario).
 */
export function PagoForm({ modo, pago, onSuccess }: PagoFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(pago))

  // Parche inmutable de un campo del form.
  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const monto = Number(form.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor a 0.")
      return
    }

    const payload = {
      concepto: form.concepto.trim(),
      monto,
      moneda: form.moneda.trim() === "" ? "MXN" : form.moneda.trim(),
      fechaProgramada: nullable(form.fechaProgramada),
      metodo: nullable(form.metodo),
      proyectoId: nullable(form.proyectoId),
      cotizacionId: nullable(form.cotizacionId),
    }

    startTransition(async () => {
      const res =
        modo === "editar" && pago
          ? await actualizarPago(pago.id, payload)
          : await crearPago(payload)

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
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="pago-concepto">Concepto</Label>
        <Input
          id="pago-concepto"
          value={form.concepto}
          onChange={(e) => set("concepto", e.target.value)}
          disabled={pending}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-monto">Monto</Label>
        <Input
          id="pago-monto"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.monto}
          onChange={(e) => set("monto", e.target.value)}
          disabled={pending}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-moneda">Moneda</Label>
        <Input
          id="pago-moneda"
          value={form.moneda}
          onChange={(e) => set("moneda", e.target.value)}
          disabled={pending}
          maxLength={8}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-fecha">Fecha programada</Label>
        <Input
          id="pago-fecha"
          type="date"
          value={form.fechaProgramada}
          onChange={(e) => set("fechaProgramada", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-metodo">Método de pago</Label>
        <Input
          id="pago-metodo"
          value={form.metodo}
          onChange={(e) => set("metodo", e.target.value)}
          disabled={pending}
          maxLength={60}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-proyecto">Proyecto (UUID)</Label>
        <Input
          id="pago-proyecto"
          value={form.proyectoId}
          onChange={(e) => set("proyectoId", e.target.value)}
          disabled={pending}
          placeholder="Opcional"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pago-cotizacion">Cotización (UUID)</Label>
        <Input
          id="pago-cotizacion"
          value={form.cotizacionId}
          onChange={(e) => set("cotizacionId", e.target.value)}
          disabled={pending}
          placeholder="Opcional"
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Guardando…"
            : modo === "editar"
              ? "Guardar cambios"
              : "Crear pago"}
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
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  )
}
