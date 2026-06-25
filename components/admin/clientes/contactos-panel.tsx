"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Star, Trash2, X } from "lucide-react"

import {
  agregarContacto,
  actualizarContacto,
  eliminarContacto,
} from "@/lib/admin/actions"
import type { ContactoRow } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

export interface ContactosPanelProps {
  clienteId: string
  contactos: ReadonlyArray<ContactoRow>
  /** RBAC clientes:edit -> habilita alta/edicion/borrado. */
  puedeEditar: boolean
}

interface ContactoFormState {
  nombre: string
  cargo: string
  email: string
  telefono: string
  esPrincipal: boolean
}

const VACIO: ContactoFormState = {
  nombre: "",
  cargo: "",
  email: "",
  telefono: "",
  esPrincipal: false,
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Panel de contactos de un cliente. Lista los contactos (destaca el principal)
 * y, si el rol puede editar, permite agregar, editar y borrar contactos via
 * server actions dentro de useTransition. Refresca la ruta al exito.
 */
export function ContactosPanel({
  clienteId,
  contactos,
  puedeEditar,
}: ContactosPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // null = cerrado, "nuevo" = alta, o id del contacto en edicion.
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<ContactoFormState>(VACIO)

  function set<K extends keyof ContactoFormState>(
    key: K,
    value: ContactoFormState[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function abrirNuevo(): void {
    setError(null)
    setForm(VACIO)
    setEditando("nuevo")
  }

  function abrirEdicion(contacto: ContactoRow): void {
    setError(null)
    setForm({
      nombre: contacto.nombre ?? "",
      cargo: contacto.cargo ?? "",
      email: contacto.email ?? "",
      telefono: contacto.telefono ?? "",
      esPrincipal: contacto.esPrincipal,
    })
    setEditando(contacto.id)
  }

  function cerrar(): void {
    setEditando(null)
    setForm(VACIO)
    setError(null)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload = {
      nombre: form.nombre.trim(),
      cargo: nullable(form.cargo),
      email: nullable(form.email),
      telefono: nullable(form.telefono),
      esPrincipal: form.esPrincipal,
    }

    startTransition(async () => {
      const res =
        editando && editando !== "nuevo"
          ? await actualizarContacto(editando, payload)
          : await agregarContacto(clienteId, payload)

      if (!res.ok) {
        setError(res.error)
        return
      }

      cerrar()
      router.refresh()
    })
  }

  function borrar(id: string): void {
    setError(null)
    startTransition(async () => {
      const res = await eliminarContacto(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {contactos.length} contacto{contactos.length === 1 ? "" : "s"}
          </p>
          {editando === null ? (
            <Button type="button" size="sm" onClick={abrirNuevo}>
              <Plus className="size-4" aria-hidden />
              Agregar contacto
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Form de alta/edicion */}
      {puedeEditar && editando !== null ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="contacto-nombre">Nombre</Label>
            <Input
              id="contacto-nombre"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contacto-cargo">Cargo</Label>
            <Input
              id="contacto-cargo"
              value={form.cargo}
              onChange={(e) => set("cargo", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contacto-email">Correo</Label>
            <Input
              id="contacto-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contacto-telefono">Teléfono</Label>
            <Input
              id="contacto-telefono"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              disabled={pending}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={form.esPrincipal}
              onChange={(e) => set("esPrincipal", e.target.checked)}
              disabled={pending}
              className="size-4 rounded border-border"
            />
            Contacto principal
          </label>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? "Guardando…"
                : editando === "nuevo"
                  ? "Agregar"
                  : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={cerrar}
            >
              <X className="size-4" aria-hidden />
              Cancelar
            </Button>
            {error ? (
              <span className="text-sm text-destructive">{error}</span>
            ) : null}
          </div>
        </form>
      ) : null}

      {/* Errores fuera del form (ej. al borrar) */}
      {error && editando === null ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {/* Lista de contactos */}
      {contactos.length === 0 ? (
        <EmptyState
          title="Sin contactos"
          description="Este cliente aún no tiene contactos registrados."
          size="sm"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contactos.map((contacto) => (
            <li
              key={contacto.id}
              className={cn(
                "rounded-lg border p-3",
                contacto.esPrincipal
                  ? "border-brand/40 bg-brand/5 dark:border-primary/40 dark:bg-primary/10"
                  : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    {contacto.esPrincipal ? (
                      <Star
                        className="size-3.5 fill-current text-brand dark:text-primary"
                        aria-label="Principal"
                      />
                    ) : null}
                    {contacto.nombre}
                  </p>
                  {contacto.cargo ? (
                    <p className="text-xs text-muted-foreground">
                      {contacto.cargo}
                    </p>
                  ) : null}
                </div>

                {puedeEditar ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Editar contacto"
                      disabled={pending}
                      onClick={() => abrirEdicion(contacto)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Eliminar contacto"
                      disabled={pending}
                      onClick={() => borrar(contacto.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>

              <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                <dd>{contacto.email ?? "—"}</dd>
                <dd>{contacto.telefono ?? "—"}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
