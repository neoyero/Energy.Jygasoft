"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Network } from "lucide-react"

import { actualizarJerarquiaUsuario } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface UsuarioJerarquiaButtonProps {
  id: string
  nombre: string
  cargo: string | null
  reportaA: string | null
  areaId: string | null
  /** Usuarios para el selector de jefe (se excluye el propio). */
  usuarios: ReadonlyArray<{ id: string; nombre: string }>
  /** Áreas activas para el selector. */
  areas: ReadonlyArray<{ id: string; nombre: string }>
}

/**
 * Acceso a editar la posición de un usuario en el organigrama: jefe directo,
 * cargo y área. La validación anti-ciclos vive en la server action.
 */
export function UsuarioJerarquiaButton({
  id,
  nombre,
  cargo,
  reportaA,
  areaId,
  usuarios,
  areas,
}: UsuarioJerarquiaButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cargoVal, setCargoVal] = useState(cargo ?? "")
  const [reportaVal, setReportaVal] = useState(reportaA ?? "")
  const [areaVal, setAreaVal] = useState(areaId ?? "")

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await actualizarJerarquiaUsuario(id, {
        cargo: cargoVal.trim() || null,
        reportaA: reportaVal || null,
        areaId: areaVal || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Posición en el organigrama"
      >
        <Network className="size-4" aria-hidden /> Organización
      </Button>

      <Modal
        open={open}
        onOpenChange={(abierto) => {
          if (!abierto && !pending) setOpen(false)
        }}
        title={`Organización · ${nombre}`}
        description="Define el jefe directo, el cargo y el área de este usuario."
        size="md"
        dismissable={!pending}
      >
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="jer-cargo">Cargo</Label>
            <Input
              id="jer-cargo"
              value={cargoVal}
              onChange={(e) => setCargoVal(e.target.value)}
              disabled={pending}
              placeholder="Ej. Gerente de Ventas"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jer-jefe">Reporta a</Label>
            <select
              id="jer-jefe"
              value={reportaVal}
              onChange={(e) => setReportaVal(e.target.value)}
              disabled={pending}
              className={SELECT_CLASS}
            >
              <option value="">Sin jefe (tope del organigrama)</option>
              {usuarios
                .filter((u) => u.id !== id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jer-area">Área</Label>
            <select
              id="jer-area"
              value={areaVal}
              onChange={(e) => setAreaVal(e.target.value)}
              disabled={pending}
              className={SELECT_CLASS}
            >
              <option value="">Sin área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
          </div>
        </form>
      </Modal>
    </>
  )
}
