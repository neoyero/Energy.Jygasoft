"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { crearCargo, actualizarCargo } from "@/lib/admin/actions"
import type { CargoRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CargoFormCargo = Pick<CargoRow, "id" | "nombre" | "activo" | "orden">

export interface CargoFormProps {
  modo: "crear" | "editar"
  cargo?: CargoFormCargo
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

/** Alta/edición de un cargo del catálogo: nombre, orden y estado. */
export function CargoForm({ modo, cargo, onSuccess, onCancel, onSavingChange }: CargoFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(cargo?.nombre ?? "")
  const [orden, setOrden] = useState(String(cargo?.orden ?? 0))
  const [activo, setActivo] = useState(cargo?.activo ?? true)

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload = { nombre: nombre.trim(), orden: Number(orden) || 0, activo }
    startTransition(async () => {
      const res =
        modo === "editar" && cargo
          ? await actualizarCargo(cargo.id, payload)
          : await crearCargo(payload)
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
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <div className="space-y-1.5">
          <Label htmlFor="cargo-nombre">Nombre</Label>
          <Input
            id="cargo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={pending}
            placeholder="Ej. Director"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cargo-orden">Orden</Label>
          <Input
            id="cargo-orden"
            type="number"
            min={0}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border"
        />
        Activo
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear cargo"}
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
