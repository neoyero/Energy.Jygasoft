"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { crearActividad, actualizarActividad } from "@/lib/admin/actions"
import type { VendedorOption } from "@/lib/admin/queries"
import { actividadTipo, actividadPrioridad, entidadTipo } from "@/db/schema"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  EntidadPicker,
  type EntidadSeleccionada,
} from "@/components/admin/actividades/entidad-picker"
import {
  isoToLocalInput,
  nullable,
  venceAtToIso,
} from "@/components/admin/actividades/actividad-utils"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

type ActividadTipo = (typeof actividadTipo.enumValues)[number]
type ActividadPrioridad = (typeof actividadPrioridad.enumValues)[number]
type EntidadTipo = (typeof entidadTipo.enumValues)[number]

export interface ActividadEditable {
  id: string
  tipo: string
  titulo: string
  descripcion: string | null
  prioridad: string
  asignadoA: string | null
  venceAt: string | null
}

export interface ActividadFormProps {
  modo: "crear" | "editar"
  /** Valores actuales (modo editar). */
  actividad?: ActividadEditable
  /** Entidad fija (ficha de detalle); si falta en alta, se muestra el picker. */
  entidadFija?: { tipo: EntidadTipo; id: string }
  vendedores: ReadonlyArray<VendedorOption>
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

interface FormState {
  tipo: string
  prioridad: string
  titulo: string
  descripcion: string
  asignadoA: string
  venceAt: string
}

/**
 * Formulario de alta/edición de actividad. En alta sin entidad fija muestra el
 * selector de entidad (agenda global); en una ficha de detalle la entidad viene
 * dada. Llama a las server actions dentro de useTransition y refresca al éxito.
 */
export function ActividadForm({
  modo,
  actividad,
  entidadFija,
  vendedores,
  onSuccess,
  onCancel,
  onSavingChange,
}: ActividadFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [entidad, setEntidad] = useState<EntidadSeleccionada | null>(null)
  const [form, setForm] = useState<FormState>({
    tipo: actividad?.tipo ?? "tarea",
    prioridad: actividad?.prioridad ?? "media",
    titulo: actividad?.titulo ?? "",
    descripcion: actividad?.descripcion ?? "",
    asignadoA: actividad?.asignadoA ?? "",
    venceAt: isoToLocalInput(actividad?.venceAt ?? null),
  })

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // En alta global hace falta elegir entidad; en ficha de detalle viene dada.
  const necesitaPicker = modo === "crear" && !entidadFija

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const base = {
      tipo: form.tipo as ActividadTipo,
      titulo: form.titulo.trim(),
      descripcion: nullable(form.descripcion),
      prioridad: form.prioridad as ActividadPrioridad,
      asignadoA: nullable(form.asignadoA),
      venceAt: venceAtToIso(form.venceAt),
    }

    startTransition(async () => {
      if (modo === "editar" && actividad) {
        const res = await actualizarActividad(actividad.id, base)
        if (!res.ok) {
          setError(res.error)
          return
        }
        router.refresh()
        onSuccess?.()
        return
      }

      // Alta: resuelve la entidad (fija o elegida en el picker).
      const ent = entidadFija ?? (entidad ? { tipo: entidad.tipo, id: entidad.id } : null)
      if (!ent) {
        setError("Selecciona la entidad a la que pertenece la actividad.")
        return
      }
      const res = await crearActividad({
        entidadTipo: ent.tipo as EntidadTipo,
        entidadId: ent.id,
        ...base,
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
    <form onSubmit={onSubmit} className="grid gap-4">
      {necesitaPicker ? (
        <EntidadPicker value={entidad} onChange={setEntidad} disabled={pending} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="act-tipo">Tipo</Label>
          <select
            id="act-tipo"
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {actividadTipo.enumValues.map((t) => (
              <option key={t} value={t}>
                {labelFor(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="act-prioridad">Prioridad</Label>
          <select
            id="act-prioridad"
            value={form.prioridad}
            onChange={(e) => set("prioridad", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {actividadPrioridad.enumValues.map((p) => (
              <option key={p} value={p}>
                {labelFor(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="act-asignado">Asignado a</Label>
          <select
            id="act-asignado"
            value={form.asignadoA}
            onChange={(e) => set("asignadoA", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin asignar</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="act-titulo">Título</Label>
        <Input
          id="act-titulo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          disabled={pending}
          placeholder="Ej. Llamar para agendar visita técnica"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="act-desc">Descripción</Label>
        <textarea
          id="act-desc"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          disabled={pending}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="act-vence">Vence</Label>
        <Input
          id="act-vence"
          type="datetime-local"
          value={form.venceAt}
          onChange={(e) => set("venceAt", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear actividad"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            <X className="size-4" aria-hidden /> Cancelar
          </Button>
        ) : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  )
}
