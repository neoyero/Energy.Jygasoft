"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearPaquete, actualizarPaquete } from "@/lib/admin/actions"
import type { PaqueteRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

type PaqueteInput = Parameters<typeof crearPaquete>[0]

const SEGMENTOS: ReadonlyArray<{ value: "residencial" | "comercial" | "industrial"; label: string }> = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
]

export interface PaqueteFormProps {
  modo: "crear" | "editar"
  paquete?: PaqueteRow
  onSuccess?: (id?: string) => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

interface FormState {
  nombre: string
  segmento: "residencial" | "comercial" | "industrial"
  capacidadKwp: string
  descripcion: string
  activo: boolean
}

function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function estadoInicial(p?: PaqueteRow): FormState {
  return {
    nombre: p?.nombre ?? "",
    segmento: p?.segmento ?? "residencial",
    capacidadKwp: p?.capacidadKwp != null ? String(p.capacidadKwp) : "",
    descripcion: p?.descripcion ?? "",
    activo: p?.activo ?? true,
  }
}

/**
 * Formulario de cabecera de un paquete (nombre, segmento, capacidad nominal,
 * descripción, activo). Las líneas se editan aparte en el detalle. Llama a
 * crearPaquete / actualizarPaquete en useTransition y refresca la ruta al éxito.
 */
export function PaqueteForm({ modo, paquete, onSuccess, onCancel, onSavingChange }: PaqueteFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(paquete))

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload: PaqueteInput = {
      nombre: form.nombre.trim(),
      segmento: form.segmento,
      capacidadKwp: numOrNull(form.capacidadKwp),
      descripcion: nullable(form.descripcion),
      activo: form.activo,
    }
    startTransition(async () => {
      const res =
        modo === "editar" && paquete
          ? await actualizarPaquete(paquete.id, payload)
          : await crearPaquete(payload)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
      const nuevoId = "id" in res ? (res.id as string | undefined) : undefined
      onSuccess?.(nuevoId)
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="paq-nombre">Nombre</Label>
        <Input
          id="paq-nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          disabled={pending}
          placeholder="Ej. Paquete Residencial 5 kWp"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paq-segmento">Segmento</Label>
        <select
          id="paq-segmento"
          value={form.segmento}
          onChange={(e) => set("segmento", e.target.value as FormState["segmento"])}
          disabled={pending}
          className={SELECT_CLASS}
        >
          {SEGMENTOS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paq-capacidad">Capacidad nominal (kWp)</Label>
        <Input
          id="paq-capacidad"
          value={form.capacidadKwp}
          onChange={(e) => set("capacidadKwp", e.target.value)}
          disabled={pending}
          inputMode="decimal"
          placeholder="Para el «mejor ajuste»"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="paq-descripcion">Descripción</Label>
        <textarea
          id="paq-descripcion"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => set("activo", e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Activo (seleccionable en cotizaciones)
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear paquete"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  )
}
