"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearCampana, actualizarCampana } from "@/lib/admin/actions"
import type { CampanaRow } from "@/lib/admin/queries"
import { campanaPlataforma, campanaEstado } from "@/db/schema"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface CampanaFormProps {
  modo: "crear" | "editar"
  campana?: CampanaRow
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

interface FormState {
  nombre: string
  plataforma: string
  estado: string
  segmento: string
  zona: string
  objetivo: string
  presupuesto: string
  gasto: string
  moneda: string
  utmCampaign: string
  fechaInicio: string
  fechaFin: string
}

function nz(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Alta/edición de una campaña de marketing. */
export function CampanaForm({ modo, campana, onSuccess, onCancel, onSavingChange }: CampanaFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    nombre: campana?.nombre ?? "",
    plataforma: campana?.plataforma ?? campanaPlataforma.enumValues[0],
    estado: campana?.estado ?? "borrador",
    segmento: campana?.segmento ?? "",
    zona: campana?.zona ?? "",
    objetivo: campana?.objetivo ?? "",
    presupuesto: campana?.presupuesto != null ? String(campana.presupuesto) : "",
    gasto: campana?.gasto != null ? String(campana.gasto) : "",
    moneda: campana?.moneda ?? "MXN",
    utmCampaign: campana?.utmCampaign ?? "",
    fechaInicio: campana?.fechaInicio ?? "",
    fechaFin: campana?.fechaFin ?? "",
  })

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload = {
      nombre: form.nombre.trim(),
      plataforma: form.plataforma as (typeof campanaPlataforma.enumValues)[number],
      estado: form.estado as (typeof campanaEstado.enumValues)[number],
      segmento: nz(form.segmento),
      zona: nz(form.zona),
      objetivo: nz(form.objetivo),
      presupuesto: nz(form.presupuesto),
      gasto: nz(form.gasto),
      moneda: form.moneda.trim() || "MXN",
      utmCampaign: nz(form.utmCampaign),
      fechaInicio: nz(form.fechaInicio),
      fechaFin: nz(form.fechaFin),
    }
    startTransition(async () => {
      const res =
        modo === "editar" && campana
          ? await actualizarCampana(campana.id, payload)
          : await crearCampana(payload)
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
      <div className="space-y-1.5">
        <Label htmlFor="cmp-nombre">Nombre</Label>
        <Input
          id="cmp-nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          disabled={pending}
          placeholder="Ej. YouTube residencial Q3"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cmp-plataforma">Plataforma</Label>
          <select
            id="cmp-plataforma"
            value={form.plataforma}
            onChange={(e) => set("plataforma", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {campanaPlataforma.enumValues.map((p) => (
              <option key={p} value={p}>
                {labelFor(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-estado">Estado</Label>
          <select
            id="cmp-estado"
            value={form.estado}
            onChange={(e) => set("estado", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {campanaEstado.enumValues.map((s) => (
              <option key={s} value={s}>
                {labelFor(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-utm">UTM campaign</Label>
          <Input
            id="cmp-utm"
            value={form.utmCampaign}
            onChange={(e) => set("utmCampaign", e.target.value)}
            disabled={pending}
            placeholder="utm_campaign"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cmp-segmento">Segmento</Label>
          <Input
            id="cmp-segmento"
            value={form.segmento}
            onChange={(e) => set("segmento", e.target.value)}
            disabled={pending}
            placeholder="residencial / negocio"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-zona">Zona</Label>
          <Input
            id="cmp-zona"
            value={form.zona}
            onChange={(e) => set("zona", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cmp-objetivo">Objetivo</Label>
        <textarea
          id="cmp-objetivo"
          value={form.objetivo}
          onChange={(e) => set("objetivo", e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cmp-presupuesto">Presupuesto</Label>
          <Input
            id="cmp-presupuesto"
            type="number"
            min="0"
            step="0.01"
            value={form.presupuesto}
            onChange={(e) => set("presupuesto", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-gasto">Gasto real</Label>
          <Input
            id="cmp-gasto"
            type="number"
            min="0"
            step="0.01"
            value={form.gasto}
            onChange={(e) => set("gasto", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-moneda">Moneda</Label>
          <Input
            id="cmp-moneda"
            value={form.moneda}
            onChange={(e) => set("moneda", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cmp-inicio">Inicio</Label>
          <Input
            id="cmp-inicio"
            type="date"
            value={form.fechaInicio}
            onChange={(e) => set("fechaInicio", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-fin">Fin</Label>
          <Input
            id="cmp-fin"
            type="date"
            value={form.fechaFin}
            onChange={(e) => set("fechaFin", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear campaña"}
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
