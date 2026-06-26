"use client"

import type { ReactNode } from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { instalacionEstado } from "@/db/schema"
import { guardarInstalacion } from "@/lib/admin/actions"
import type { InstalacionRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { labelFor, StatusBadge } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
const TEXTAREA_CLASS =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"

const DASH = "—"

const ESTADOS = instalacionEstado.enumValues

export interface InstalacionPanelProps {
  proyectoId: string
  instalacion: InstalacionRow | null
  cuadrillas: ReadonlyArray<{ id: string; nombre: string }>
  /** RBAC proyectos:edit -> habilita el formulario; si no, solo lectura. */
  puedeEditar: boolean
}

interface FormState {
  estado: string
  cuadrillaId: string
  fechaInicio: string
  fechaFin: string
  avancePct: string
  notas: string
}

/** Estado inicial a partir de la instalación (o vacios si no existe). */
function estadoInicial(instalacion: InstalacionRow | null): FormState {
  return {
    estado: instalacion?.estado ?? ESTADOS[0],
    cuadrillaId: instalacion?.cuadrillaId ?? "",
    fechaInicio: instalacion?.fechaInicio ?? "",
    fechaFin: instalacion?.fechaFin ?? "",
    avancePct: String(instalacion?.avancePct ?? 0),
    notas: instalacion?.notas ?? "",
  }
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Clamp 0..100 de un avance ingresado (NaN -> 0). */
function clampPct(v: string): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

/**
 * Panel de la instalación de un proyecto. Si el rol puede editar muestra un
 * form controlado (upsert via guardarInstalacion en useTransition) con barra de
 * progreso del avance; si no, una ficha de solo lectura.
 */
export function InstalacionPanel({
  proyectoId,
  instalacion,
  cuadrillas,
  puedeEditar,
}: InstalacionPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(instalacion))

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const avanceForm = clampPct(form.avancePct)

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload = {
      estado: form.estado as (typeof ESTADOS)[number],
      cuadrillaId: nullable(form.cuadrillaId),
      fechaInicio: nullable(form.fechaInicio),
      fechaFin: nullable(form.fechaFin),
      avancePct: clampPct(form.avancePct),
      notas: nullable(form.notas),
    }

    startTransition(async () => {
      const res = await guardarInstalacion(proyectoId, payload)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  if (!puedeEditar) {
    if (!instalacion) {
      return (
        <EmptyState
          title="Sin instalación"
          description="Este proyecto no tiene instalación registrada."
          size="sm"
        />
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <Field
            label="Estado"
            value={<StatusBadge value={instalacion.estado} withDot={false} />}
          />
          <Field
            label="Cuadrilla"
            value={instalacion.cuadrillaNombre ?? "Sin asignar"}
          />
          <Field
            label="Inicio"
            value={fmtFechaRel(instalacion.fechaInicio)}
          />
          <Field label="Fin" value={fmtFechaRel(instalacion.fechaFin)} />
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Avance
            </dt>
            <Barra pct={instalacion.avancePct} />
          </div>
          <Field
            label="Notas"
            value={instalacion.notas ?? DASH}
            className="sm:col-span-2"
          />
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="instalacion-estado">Estado</Label>
        <select
          id="instalacion-estado"
          value={form.estado}
          onChange={(e) => set("estado", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          {ESTADOS.map((s) => (
            <option key={s} value={s}>
              {labelFor(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instalacion-cuadrilla">Cuadrilla</Label>
        <select
          id="instalacion-cuadrilla"
          value={form.cuadrillaId}
          onChange={(e) => set("cuadrillaId", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin asignar</option>
          {cuadrillas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instalacion-inicio">Fecha inicio</Label>
        <Input
          id="instalacion-inicio"
          type="date"
          value={form.fechaInicio}
          onChange={(e) => set("fechaInicio", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instalacion-fin">Fecha fin</Label>
        <Input
          id="instalacion-fin"
          type="date"
          value={form.fechaFin}
          onChange={(e) => set("fechaFin", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="instalacion-avance">Avance (%)</Label>
        <Input
          id="instalacion-avance"
          type="number"
          min={0}
          max={100}
          step={1}
          value={form.avancePct}
          onChange={(e) => set("avancePct", e.target.value)}
          disabled={pending}
        />
        <Barra pct={avanceForm} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="instalacion-notas">Notas</Label>
        <textarea
          id="instalacion-notas"
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
          disabled={pending}
          rows={3}
          className={TEXTAREA_CLASS}
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar instalación"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  )
}

/** Par etiqueta/valor reutilizable (solo lectura). */
function Field({
  label,
  value,
  className,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}

/** Barra de progreso del avance de instalación. */
function Barra({ pct }: { pct: number }) {
  const safe = Math.min(100, Math.max(0, pct))
  return (
    <div className="mt-1 flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-foreground">{safe}%</span>
    </div>
  )
}
