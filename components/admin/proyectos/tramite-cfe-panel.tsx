"use client"

import type { ReactNode } from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { tramiteCfeEstado, esquemaCfe } from "@/db/schema"
import { guardarTramiteCfe } from "@/lib/admin/actions"
import type { TramiteCfeRow } from "@/lib/admin/queries"
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

const ESTADOS = tramiteCfeEstado.enumValues
const ESQUEMAS = esquemaCfe.enumValues

export interface TramiteCfePanelProps {
  proyectoId: string
  tramite: TramiteCfeRow | null
  /** RBAC proyectos:edit -> habilita el formulario; si no, solo lectura. */
  puedeEditar: boolean
}

interface FormState {
  estado: string
  folioCfe: string
  esquema: string
  estudioRequerido: boolean
  fechaSolicitud: string
  fechaOficio: string
  fechaMedidor: string
  fechaOperacion: string
  observaciones: string
}

/** Estado inicial del form a partir del trámite (o vacios si no existe). */
function estadoInicial(tramite: TramiteCfeRow | null): FormState {
  return {
    estado: tramite?.estado ?? ESTADOS[0],
    folioCfe: tramite?.folioCfe ?? "",
    esquema: tramite?.esquema ?? "",
    estudioRequerido: tramite?.estudioRequerido ?? false,
    fechaSolicitud: tramite?.fechaSolicitud ?? "",
    fechaOficio: tramite?.fechaOficio ?? "",
    fechaMedidor: tramite?.fechaMedidor ?? "",
    fechaOperacion: tramite?.fechaOperacion ?? "",
    observaciones: tramite?.observaciones ?? "",
  }
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Panel del trámite CFE de un proyecto. Si el rol puede editar muestra un form
 * controlado (upsert via guardarTramiteCfe en useTransition); si no, una ficha
 * de solo lectura con estado, datos y la línea de tiempo de las 4 fechas.
 */
export function TramiteCfePanel({
  proyectoId,
  tramite,
  puedeEditar,
}: TramiteCfePanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(tramite))

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload = {
      estado: form.estado as (typeof ESTADOS)[number],
      folioCfe: nullable(form.folioCfe),
      esquema: (nullable(form.esquema) as (typeof ESQUEMAS)[number] | null),
      estudioRequerido: form.estudioRequerido,
      fechaSolicitud: nullable(form.fechaSolicitud),
      fechaOficio: nullable(form.fechaOficio),
      fechaMedidor: nullable(form.fechaMedidor),
      fechaOperacion: nullable(form.fechaOperacion),
      observaciones: nullable(form.observaciones),
    }

    startTransition(async () => {
      const res = await guardarTramiteCfe(proyectoId, payload)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  if (!puedeEditar) {
    if (!tramite) {
      return (
        <EmptyState
          title="Sin trámite CFE"
          description="Este proyecto no tiene trámite CFE registrado."
          size="sm"
        />
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <Field
            label="Estado"
            value={<StatusBadge value={tramite.estado} withDot={false} />}
          />
          <Field label="Folio CFE" value={tramite.folioCfe ?? DASH} />
          <Field
            label="Esquema"
            value={tramite.esquema ? labelFor(tramite.esquema) : DASH}
          />
          <Field
            label="Estudio requerido"
            value={tramite.estudioRequerido ? "Sí" : "No"}
          />
          <Field
            label="Observaciones"
            value={tramite.observaciones ?? DASH}
            className="sm:col-span-2"
          />
        </div>

        <Linea
          fechas={[
            { label: "Solicitud", iso: tramite.fechaSolicitud },
            { label: "Oficio", iso: tramite.fechaOficio },
            { label: "Medidor", iso: tramite.fechaMedidor },
            { label: "Operación", iso: tramite.fechaOperacion },
          ]}
        />
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="tramite-estado">Estado</Label>
        <select
          id="tramite-estado"
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
        <Label htmlFor="tramite-folio">Folio CFE</Label>
        <Input
          id="tramite-folio"
          value={form.folioCfe}
          onChange={(e) => set("folioCfe", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tramite-esquema">Esquema</Label>
        <select
          id="tramite-esquema"
          value={form.esquema}
          onChange={(e) => set("esquema", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin especificar</option>
          {ESQUEMAS.map((s) => (
            <option key={s} value={s}>
              {labelFor(s)}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.estudioRequerido}
          onChange={(e) => set("estudioRequerido", e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Estudio requerido
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="tramite-f-solicitud">Fecha solicitud</Label>
        <Input
          id="tramite-f-solicitud"
          type="date"
          value={form.fechaSolicitud}
          onChange={(e) => set("fechaSolicitud", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tramite-f-oficio">Fecha oficio</Label>
        <Input
          id="tramite-f-oficio"
          type="date"
          value={form.fechaOficio}
          onChange={(e) => set("fechaOficio", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tramite-f-medidor">Fecha medidor</Label>
        <Input
          id="tramite-f-medidor"
          type="date"
          value={form.fechaMedidor}
          onChange={(e) => set("fechaMedidor", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tramite-f-operacion">Fecha operación</Label>
        <Input
          id="tramite-f-operacion"
          type="date"
          value={form.fechaOperacion}
          onChange={(e) => set("fechaOperacion", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tramite-observaciones">Observaciones</Label>
        <textarea
          id="tramite-observaciones"
          value={form.observaciones}
          onChange={(e) => set("observaciones", e.target.value)}
          disabled={pending}
          rows={3}
          className={TEXTAREA_CLASS}
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar trámite"}
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

/** Línea de tiempo de las 4 fechas del trámite (solo lectura). */
function Linea({
  fechas,
}: {
  fechas: ReadonlyArray<{ label: string; iso: string | null }>
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fechas.map((f) => (
        <li key={f.label} className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {f.label}
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {fmtFechaRel(f.iso)}
          </p>
        </li>
      ))}
    </ol>
  )
}
