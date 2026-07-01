"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { createUsuario, updateUsuario } from "@/lib/admin/actions"
import { ROLES, type Rol } from "@/lib/admin/rbac"
import type { UsuarioAdminRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface UsuarioFormProps {
  modo: "crear" | "editar"
  usuario?: UsuarioAdminRow
  /** Usuarios para el selector "Reporta a" (se excluye el propio en edición). */
  usuarios: ReadonlyArray<{ id: string; nombre: string }>
  /** Áreas activas para el selector. */
  areas: ReadonlyArray<{ id: string; nombre: string }>
  /** Cargos activos del catálogo para el selector. */
  cargos: ReadonlyArray<{ id: string; nombre: string }>
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

interface FormState {
  nombre: string
  email: string
  rol: string
  telefono: string
  cargoId: string
  reportaA: string
  areaId: string
}

function nz(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Alta/edición de un miembro del equipo en un único modal (homologado con el
 * resto del panel): datos de acceso (nombre, correo, rol, teléfono) + posición
 * en el organigrama (cargo, jefe, área). El correo solo se define al crear (es
 * la identidad de login OTP).
 */
export function UsuarioForm({
  modo,
  usuario,
  usuarios,
  areas,
  cargos,
  onSuccess,
  onCancel,
  onSavingChange,
}: UsuarioFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol: usuario?.rol ?? "vendedor",
    telefono: usuario?.telefono ?? "",
    cargoId: usuario?.cargoId ?? "",
    reportaA: usuario?.reportaA ?? "",
    areaId: usuario?.areaId ?? "",
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
    const base = {
      nombre: form.nombre.trim(),
      rol: form.rol as Rol,
      telefono: nz(form.telefono),
      cargoId: nz(form.cargoId),
      reportaA: nz(form.reportaA),
      areaId: nz(form.areaId),
    }
    startTransition(async () => {
      const res =
        modo === "editar" && usuario
          ? await updateUsuario(usuario.id, base)
          : await createUsuario({ ...base, email: form.email.trim().toLowerCase() })
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
          <Label htmlFor="u-nombre">Nombre</Label>
          <Input
            id="u-nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-email">Correo</Label>
          <Input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={pending || modo === "editar"}
            required={modo === "crear"}
            placeholder="nombre@empresa.com"
          />
          {modo === "editar" ? (
            <p className="text-xs text-muted-foreground">
              El correo es la identidad de acceso y no se edita.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-rol">Rol</Label>
          <select
            id="u-rol"
            value={form.rol}
            onChange={(e) => set("rol", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-telefono">Teléfono</Label>
          <Input
            id="u-telefono"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="u-cargo">Cargo</Label>
          <select
            id="u-cargo"
            value={form.cargoId}
            onChange={(e) => set("cargoId", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin cargo</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-jefe">Reporta a</Label>
          <select
            id="u-jefe"
            value={form.reportaA}
            onChange={(e) => set("reportaA", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin jefe</option>
            {usuarios
              .filter((u) => u.id !== usuario?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-area">Área</Label>
          <select
            id="u-area"
            value={form.areaId}
            onChange={(e) => set("areaId", e.target.value)}
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
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Agregar al equipo"}
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
