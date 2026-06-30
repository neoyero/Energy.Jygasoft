"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearArea, actualizarArea } from "@/lib/admin/actions"
import type { AreaRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface AreaFormProps {
  modo: "crear" | "editar"
  area?: AreaRow
  /** Usuarios para el selector de líder. */
  usuarios: ReadonlyArray<{ id: string; nombre: string }>
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Alta/edición de un área: nombre, descripción, líder y estado. */
export function AreaForm({ modo, area, usuarios, onSuccess, onCancel, onSavingChange }: AreaFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(area?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(area?.descripcion ?? "")
  const [liderId, setLiderId] = useState(area?.liderId ?? "")
  const [activa, setActiva] = useState(area?.activa ?? true)

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload = {
      nombre: nombre.trim(),
      descripcion: nullable(descripcion),
      liderId: nullable(liderId),
      activa,
    }
    startTransition(async () => {
      const res =
        modo === "editar" && area
          ? await actualizarArea(area.id, payload)
          : await crearArea(payload)
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
        <Label htmlFor="area-nombre">Nombre</Label>
        <Input
          id="area-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={pending}
          placeholder="Ej. Comercial"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="area-desc">Descripción</Label>
        <textarea
          id="area-desc"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="area-lider">Líder del área</Label>
        <select
          id="area-lider"
          value={liderId}
          onChange={(e) => setLiderId(e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin líder</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) => setActiva(e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Activa
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear área"}
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
