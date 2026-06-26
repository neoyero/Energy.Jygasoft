"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearPago } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ProgramarPagoFormProps {
  cotizacionId: string
  /** Callback opcional tras programar el pago con exito (ej. cerrar el panel). */
  onSuccess?: () => void
}

/** Estado interno del form: strings controlados (vacios -> undefined al enviar). */
interface FormState {
  concepto: string
  monto: string
  fechaProgramada: string
  metodo: string
}

const ESTADO_INICIAL: FormState = {
  concepto: "",
  monto: "",
  fechaProgramada: "",
  metodo: "",
}

/** "" -> undefined para campos opcionales. */
function opcional(v: string): string | undefined {
  const t = v.trim()
  return t === "" ? undefined : t
}

/**
 * Formulario controlado para programar un pago asociado a una cotizacion.
 * Llama a crearPago dentro de useTransition y maneja el ActionResult inline.
 * Al exito refresca la ruta (router.refresh) e invoca onSuccess. Calca el
 * patron de cliente-form.
 */
export function ProgramarPagoForm({
  cotizacionId,
  onSuccess,
}: ProgramarPagoFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(ESTADO_INICIAL)

  // Parche inmutable de un campo del form.
  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const concepto = form.concepto.trim()
    const monto = Number(form.monto)

    if (concepto === "") {
      setError("El concepto es obligatorio.")
      return
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("El monto debe ser mayor a 0.")
      return
    }

    startTransition(async () => {
      const res = await crearPago({
        cotizacionId,
        concepto,
        monto,
        fechaProgramada: opcional(form.fechaProgramada),
        metodo: opcional(form.metodo),
      })

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
      className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2"
    >
      <div className="space-y-1.5 sm:col-span-2">
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
          min={0}
          step="0.01"
          value={form.monto}
          onChange={(e) => set("monto", e.target.value)}
          disabled={pending}
          required
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

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="pago-metodo">Método de pago</Label>
        <Input
          id="pago-metodo"
          value={form.metodo}
          onChange={(e) => set("metodo", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Programando…" : "Programar pago"}
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
