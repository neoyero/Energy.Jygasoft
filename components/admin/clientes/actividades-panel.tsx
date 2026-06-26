"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"

import { crearActividad, completarActividad } from "@/lib/admin/actions"
import type { ClienteActividadRow, VendedorOption } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { actividadTipo } from "@/db/schema"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface ActividadesPanelProps {
  clienteId: string
  actividades: ReadonlyArray<ClienteActividadRow>
  /** Vendedores asignables (para asignadoA). */
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC actividades:edit -> habilita alta y completar/reabrir. */
  puedeEditar: boolean
}

interface ActividadFormState {
  tipo: string
  titulo: string
  descripcion: string
  asignadoA: string
  venceAt: string
}

const VACIO: ActividadFormState = {
  tipo: "tarea",
  titulo: "",
  descripcion: "",
  asignadoA: "",
  venceAt: "",
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** datetime-local -> ISO; "" o invalido -> null. */
function venceAtToIso(v: string): string | null {
  const t = v.trim()
  if (t === "") return null
  const date = new Date(t)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Panel de actividades de un cliente. Lista las actividades (tipo, título,
 * estado, vencimiento y asignado) con un checkbox para completar/reabrir y, si
 * el rol puede editar, permite crear nuevas actividades via server actions
 * dentro de useTransition. Refresca la ruta al exito.
 */
export function ActividadesPanel({
  clienteId,
  actividades,
  vendedores,
  puedeEditar,
}: ActividadesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // null = cerrado, "nuevo" = alta.
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<ActividadFormState>(VACIO)

  function set<K extends keyof ActividadFormState>(
    key: K,
    value: ActividadFormState[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function abrirNuevo(): void {
    setError(null)
    setForm(VACIO)
    setEditando("nuevo")
  }

  function cerrar(): void {
    setEditando(null)
    setForm(VACIO)
    setError(null)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await crearActividad({
        entidadTipo: "cliente",
        entidadId: clienteId,
        tipo: form.tipo as (typeof actividadTipo.enumValues)[number],
        titulo: form.titulo.trim(),
        descripcion: nullable(form.descripcion),
        asignadoA: nullable(form.asignadoA),
        venceAt: venceAtToIso(form.venceAt),
      })

      if (!res.ok) {
        setError(res.error)
        return
      }

      cerrar()
      router.refresh()
    })
  }

  function alternarCompletar(id: string, completada: boolean): void {
    setError(null)
    startTransition(async () => {
      const res = await completarActividad(id, completada)
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
            {actividades.length} actividad{actividades.length === 1 ? "" : "es"}
          </p>
          {editando === null ? (
            <Button type="button" size="sm" onClick={abrirNuevo}>
              <Plus className="size-4" aria-hidden />
              Nueva actividad
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Form de alta */}
      {puedeEditar && editando !== null ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="actividad-tipo">Tipo</Label>
            <select
              id="actividad-tipo"
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
            <Label htmlFor="actividad-asignado">Asignado a</Label>
            <select
              id="actividad-asignado"
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="actividad-titulo">Título</Label>
            <Input
              id="actividad-titulo"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              disabled={pending}
              required
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="actividad-descripcion">Descripción</Label>
            <textarea
              id="actividad-descripcion"
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              disabled={pending}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actividad-vence">Vence</Label>
            <Input
              id="actividad-vence"
              type="datetime-local"
              value={form.venceAt}
              onChange={(e) => set("venceAt", e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Agregar"}
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

      {/* Errores fuera del form (ej. al completar) */}
      {error && editando === null ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {/* Lista de actividades */}
      {actividades.length === 0 ? (
        <EmptyState
          title="Sin actividades"
          description="Este cliente aún no tiene actividades registradas."
          size="sm"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {actividades.map((a) => {
            const completada = a.estado === "completada"
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                {puedeEditar ? (
                  <input
                    type="checkbox"
                    checked={completada}
                    onChange={(e) =>
                      alternarCompletar(a.id, e.target.checked)
                    }
                    disabled={pending}
                    className="mt-1 size-4 shrink-0 rounded border-border"
                    aria-label="Completar actividad"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium text-foreground",
                        completada && "line-through text-muted-foreground"
                      )}
                    >
                      {a.titulo}
                    </span>
                    <StatusBadge value={a.tipo} tone="neutral" />
                    <StatusBadge value={a.estado} />
                  </div>

                  {a.descripcion ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {a.descripcion}
                    </p>
                  ) : null}

                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <dt>Vence:</dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          a.vencida && "font-medium text-destructive"
                        )}
                      >
                        {fmtFechaRel(a.venceAt)}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt>Asignado:</dt>
                      <dd>{a.asignadoNombre ?? "Sin asignar"}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
