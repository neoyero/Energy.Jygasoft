"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { crearArea, actualizarArea } from "@/lib/admin/actions"
import type { AreaLider } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

/** Usuario disponible para asignar como líder (incluye su cargo para mostrar). */
export interface UsuarioOpcion {
  id: string
  nombre: string
  cargo?: string | null
}

/** Datos mínimos que el formulario necesita para prefilar (fila o nodo de árbol). */
export interface AreaFormArea {
  id: string
  nombre: string
  descripcion: string | null
  padreId: string | null
  activa: boolean
  lideres: AreaLider[]
}

export interface AreaFormProps {
  modo: "crear" | "editar"
  area?: AreaFormArea
  /** Usuarios para el selector de líderes (con su cargo). */
  usuarios: ReadonlyArray<UsuarioOpcion>
  /** Áreas para el selector de "área padre" (se excluye la propia al editar). */
  areas: ReadonlyArray<{ id: string; nombre: string }>
  onSuccess?: () => void
  onCancel?: () => void
  onSavingChange?: (saving: boolean) => void
}

function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Alta/edición de un área: nombre, descripción, área padre, líderes y estado. */
export function AreaForm({ modo, area, usuarios, areas, onSuccess, onCancel, onSavingChange }: AreaFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(area?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(area?.descripcion ?? "")
  const [padreId, setPadreId] = useState(area?.padreId ?? "")
  const [activa, setActiva] = useState(area?.activa ?? true)
  // Líderes en orden (el primero es el principal).
  const [lideres, setLideres] = useState<string[]>(area?.lideres.map((l) => l.id) ?? [])
  const [porAgregar, setPorAgregar] = useState("")

  const areasPadre = areas.filter((a) => a.id !== area?.id)
  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])
  const disponibles = usuarios.filter((u) => !lideres.includes(u.id))

  useEffect(() => {
    onSavingChange?.(pending)
  }, [pending, onSavingChange])

  function agregarLider(id: string): void {
    if (!id || lideres.includes(id)) return
    setLideres((prev) => [...prev, id])
    setPorAgregar("")
  }
  function quitarLider(id: string): void {
    setLideres((prev) => prev.filter((x) => x !== id))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)
    const payload = {
      nombre: nombre.trim(),
      descripcion: nullable(descripcion),
      padreId: nullable(padreId),
      lideres,
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
        <Label htmlFor="area-padre">Área padre</Label>
        <select
          id="area-padre"
          value={padreId}
          onChange={(e) => setPadreId(e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin padre (área raíz)</option>
          {areasPadre.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Deja &ldquo;sin padre&rdquo; para un área raíz. Ej.: Ventas y Preventas cuelgan de Comercial.
        </p>
      </div>

      {/* Líderes: varios por área; su rol es el cargo del usuario. */}
      <div className="space-y-1.5">
        <Label htmlFor="area-lider">Líderes del área</Label>
        <select
          id="area-lider"
          value={porAgregar}
          onChange={(e) => agregarLider(e.target.value)}
          disabled={pending || disponibles.length === 0}
          className={SELECT_CLASS}
        >
          <option value="">
            {disponibles.length === 0 ? "No hay más usuarios" : "Agregar líder…"}
          </option>
          {disponibles.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
              {u.cargo ? ` — ${u.cargo}` : ""}
            </option>
          ))}
        </select>

        {lideres.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1.5">
            {lideres.map((id, i) => {
              const u = usuariosPorId.get(id)
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-foreground">{u?.nombre ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {u?.cargo ?? "sin cargo"}
                      {i === 0 ? " (principal)" : ""}
                    </span>
                  </span>
                  {!pending ? (
                    <button
                      type="button"
                      onClick={() => quitarLider(id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      title="Quitar líder"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Sin líderes. Puedes asignar varios (p. ej. Director y Subdirectora); el rol de cada uno es su
            cargo.
          </p>
        )}
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
