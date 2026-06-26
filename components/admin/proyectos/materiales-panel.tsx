"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"

import {
  agregarMaterial,
  actualizarMaterial,
  eliminarMaterial,
  toggleMaterialEntregado,
} from "@/lib/admin/actions"
import type { CatalogoOption, ProyectoMaterialRow } from "@/lib/admin/queries"
import { formatMXN } from "@/lib/admin/format"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/admin/ui/confirm-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface MaterialesPanelProps {
  proyectoId: string
  materiales: ReadonlyArray<ProyectoMaterialRow>
  catalogo: ReadonlyArray<CatalogoOption>
  /** RBAC proyectos:edit -> habilita alta/edicion/borrado/entrega. */
  puedeEditar: boolean
}

interface MaterialFormState {
  equipoId: string
  descripcion: string
  cantidad: string
  precioUnitario: string
}

const VACIO: MaterialFormState = {
  equipoId: "",
  descripcion: "",
  cantidad: "1",
  precioUnitario: "0",
}

/** Etiqueta legible de una opcion del catalogo (tipo · marca modelo). */
function etiquetaCatalogo(o: CatalogoOption): string {
  const partes = [labelFor(o.tipo), o.marca, o.modelo].filter(Boolean)
  return partes.join(" · ")
}

/** Numero seguro (NaN -> 0, no negativos). */
function num(v: string): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/**
 * Panel de materiales de un proyecto. Lista los materiales (descripcion,
 * cantidad, precio, importe, entregado) y, si el rol puede editar, permite
 * agregar (opcionalmente desde el catalogo, que auto-llena descripcion/precio),
 * editar, borrar y alternar la entrega via server actions. Refresca al exito.
 */
export function MaterialesPanel({
  proyectoId,
  materiales,
  catalogo,
  puedeEditar,
}: MaterialesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // null = cerrado, "nuevo" = alta, o id del material en edicion.
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<MaterialFormState>(VACIO)

  function set<K extends keyof MaterialFormState>(
    key: K,
    value: MaterialFormState[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /** Al elegir un equipo del catalogo, auto-llena descripcion y precio. */
  function elegirEquipo(equipoId: string): void {
    if (equipoId === "") {
      set("equipoId", "")
      return
    }
    const opcion = catalogo.find((o) => o.id === equipoId)
    setForm((prev) => ({
      ...prev,
      equipoId,
      descripcion: opcion ? etiquetaCatalogo(opcion) : prev.descripcion,
      precioUnitario:
        opcion && opcion.precio !== null
          ? String(opcion.precio)
          : prev.precioUnitario,
    }))
  }

  function abrirNuevo(): void {
    setError(null)
    setForm(VACIO)
    setEditando("nuevo")
  }

  function abrirEdicion(material: ProyectoMaterialRow): void {
    setError(null)
    setForm({
      equipoId: material.equipoId ?? "",
      descripcion: material.descripcion,
      cantidad: String(material.cantidad),
      precioUnitario: String(material.precioUnitario),
    })
    setEditando(material.id)
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
      equipoId: form.equipoId === "" ? null : form.equipoId,
      descripcion: form.descripcion.trim(),
      cantidad: num(form.cantidad),
      precioUnitario: num(form.precioUnitario),
    }

    startTransition(async () => {
      const res =
        editando && editando !== "nuevo"
          ? await actualizarMaterial(editando, payload)
          : await agregarMaterial(proyectoId, payload)

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
      const res = await eliminarMaterial(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  function alternarEntrega(id: string, entregado: boolean): void {
    setError(null)
    startTransition(async () => {
      const res = await toggleMaterialEntregado(id, entregado)
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
            {materiales.length} material{materiales.length === 1 ? "" : "es"}
          </p>
          {editando === null ? (
            <Button type="button" size="sm" onClick={abrirNuevo}>
              <Plus className="size-4" aria-hidden />
              Agregar material
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="material-equipo">Equipo del catálogo</Label>
            <select
              id="material-equipo"
              value={form.equipoId}
              onChange={(e) => elegirEquipo(e.target.value)}
              disabled={pending}
              className={SELECT_CLASS}
            >
              <option value="">Manual (sin catálogo)</option>
              {catalogo.map((o) => (
                <option key={o.id} value={o.id}>
                  {etiquetaCatalogo(o)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="material-descripcion">Descripción</Label>
            <Input
              id="material-descripcion"
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              disabled={pending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-cantidad">Cantidad</Label>
            <Input
              id="material-cantidad"
              type="number"
              min={0}
              step="any"
              value={form.cantidad}
              onChange={(e) => set("cantidad", e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-precio">Precio unitario</Label>
            <Input
              id="material-precio"
              type="number"
              min={0}
              step="any"
              value={form.precioUnitario}
              onChange={(e) => set("precioUnitario", e.target.value)}
              disabled={pending}
            />
          </div>

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

      {/* Errores fuera del form (ej. al borrar/entregar) */}
      {error && editando === null ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {/* Lista de materiales */}
      {materiales.length === 0 ? (
        <EmptyState
          title="Sin materiales"
          description="Este proyecto aún no tiene materiales registrados."
          size="sm"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                {[
                  "Descripción",
                  "Cantidad",
                  "Precio unit.",
                  "Importe",
                  "Entregado",
                  ...(puedeEditar ? [""] : []),
                ].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-stone-700 dark:text-foreground">
                    <span className="font-medium text-foreground">
                      {m.descripcion}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-700 dark:text-foreground">
                    {m.cantidad}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-700 dark:text-foreground">
                    {formatMXN(m.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-stone-700 dark:text-foreground">
                    {formatMXN(m.importe)}
                  </td>
                  <td className="px-4 py-3">
                    {puedeEditar ? (
                      <label className="inline-flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={m.entregado}
                          onChange={(e) =>
                            alternarEntrega(m.id, e.target.checked)
                          }
                          disabled={pending}
                          className="size-4 rounded border-border"
                          aria-label="Entregado"
                        />
                        {m.entregado ? "Sí" : "No"}
                      </label>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-sm",
                          m.entregado
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {m.entregado ? (
                          <Check className="size-4" aria-hidden />
                        ) : null}
                        {m.entregado ? "Sí" : "No"}
                      </span>
                    )}
                  </td>
                  {puedeEditar ? (
                    <td className="px-4 py-3">
                      <div className="flex shrink-0 items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Editar material"
                          disabled={pending}
                          onClick={() => abrirEdicion(m)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        <ConfirmButton
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Eliminar material"
                          disabled={pending}
                          destructive
                          title="Eliminar material"
                          description={
                            <>
                              Se eliminará el material{" "}
                              <strong>{m.descripcion}</strong>. Esta acción no se
                              puede deshacer. ¿Continuar?
                            </>
                          }
                          confirmLabel="Eliminar"
                          onConfirm={() => borrar(m.id)}
                        >
                          <Trash2
                            className="size-3.5 text-destructive"
                            aria-hidden
                          />
                        </ConfirmButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
