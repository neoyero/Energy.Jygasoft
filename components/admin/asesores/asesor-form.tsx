"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearAsesor, actualizarAsesor } from "@/lib/admin/actions"
import type { AsesorRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface AsesorFormProps {
  modo: "crear" | "editar"
  asesor?: AsesorRow
  /** Usuarios del panel para vincular (un vendedor puede ser asesor). */
  usuarios: ReadonlyArray<{ id: string; nombre: string; email?: string }>
  /** true si Chatwoot está configurado (afecta el texto de ayuda). */
  chatwootActivo: boolean
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

interface FormState {
  usuarioId: string
  nombre: string
  email: string
  telefono: string
  zonas: string
  segResidencial: boolean
  segNegocio: boolean
  chatwootAgentId: string
  activo: boolean
}

function nz(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Alta/edición de un asesor (agente de conversaciones) en modal. Vincula a un
 * usuario del panel, define correo (para invitar/reconciliar en Chatwoot),
 * zonas/segmentos de ruteo y estado. Si Chatwoot está configurado, al crear con
 * correo se invita al agente automáticamente.
 */
export function AsesorForm({
  modo,
  asesor,
  usuarios,
  chatwootActivo,
  onSuccess,
  onCancel,
  onSavingChange,
}: AsesorFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    usuarioId: asesor?.usuarioId ?? "",
    nombre: asesor?.nombre ?? "",
    email: asesor?.email ?? "",
    telefono: asesor?.telefono ?? "",
    zonas: (asesor?.zonas ?? []).join(", "),
    segResidencial: (asesor?.segmentos ?? []).includes("residencial"),
    segNegocio: (asesor?.segmentos ?? []).includes("negocio"),
    chatwootAgentId: asesor?.chatwootAgentId != null ? String(asesor.chatwootAgentId) : "",
    activo: asesor?.activo ?? true,
  })

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /** Al elegir usuario, precarga nombre/email si están vacíos. */
  function elegirUsuario(id: string): void {
    const u = usuarios.find((x) => x.id === id)
    setForm((prev) => ({
      ...prev,
      usuarioId: id,
      nombre: prev.nombre.trim() === "" && u ? u.nombre : prev.nombre,
      email: prev.email.trim() === "" && u?.email ? u.email : prev.email,
    }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const segmentos: Array<"residencial" | "negocio"> = []
    if (form.segResidencial) segmentos.push("residencial")
    if (form.segNegocio) segmentos.push("negocio")
    const payload = {
      usuarioId: nz(form.usuarioId),
      nombre: form.nombre.trim(),
      email: nz(form.email),
      telefono: nz(form.telefono),
      zonas: form.zonas.split(",").map((z) => z.trim()).filter(Boolean),
      segmentos,
      chatwootAgentId: nz(form.chatwootAgentId),
      activo: form.activo,
    }
    startTransition(async () => {
      const res =
        modo === "editar" && asesor
          ? await actualizarAsesor(asesor.id, payload)
          : await crearAsesor(payload)
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="as-usuario">Usuario del panel</Label>
          <select
            id="as-usuario"
            value={form.usuarioId}
            onChange={(e) => elegirUsuario(e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin vincular</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Vincula al vendedor/usuario para poder asignarle leads.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="as-nombre">Nombre</Label>
          <Input
            id="as-nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="as-email">Correo (Chatwoot)</Label>
          <Input
            id="as-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={pending}
            placeholder="agente@empresa.com"
          />
          <p className="text-xs text-muted-foreground">
            {chatwootActivo
              ? "Al crear, se invita al agente en Chatwoot con este correo."
              : "Chatwoot no configurado: se usará para reconciliar más tarde."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="as-telefono">Teléfono</Label>
          <Input
            id="as-telefono"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="as-zonas">Zonas (municipios/CP, separadas por coma)</Label>
          <Input
            id="as-zonas"
            value={form.zonas}
            onChange={(e) => set("zonas", e.target.value)}
            disabled={pending}
            placeholder="Aguascalientes, 20000"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Segmentos</Label>
          <div className="flex h-9 items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.segResidencial}
                onChange={(e) => set("segResidencial", e.target.checked)}
                disabled={pending}
                className="size-4 rounded border-border"
              />
              Residencial
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.segNegocio}
                onChange={(e) => set("segNegocio", e.target.checked)}
                disabled={pending}
                className="size-4 rounded border-border"
              />
              Negocio
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="as-agent">ID de agente Chatwoot</Label>
          <Input
            id="as-agent"
            value={form.chatwootAgentId}
            onChange={(e) => set("chatwootAgentId", e.target.value)}
            disabled={pending}
            placeholder="(automático al invitar / o manual)"
          />
          <p className="text-xs text-muted-foreground">
            Opcional. Se llena solo al invitar o con «Sincronizar con Chatwoot».
          </p>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => set("activo", e.target.checked)}
            disabled={pending}
            className="size-4 rounded border-border"
          />
          Activo (asignable a leads)
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Registrar asesor"}
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
