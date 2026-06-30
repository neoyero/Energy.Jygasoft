"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, RotateCcw, Trash2, XCircle } from "lucide-react"

import {
  completarActividad,
  cancelarActividad,
  eliminarActividad,
} from "@/lib/admin/actions"
import type { ClienteActividadRow, VendedorOption } from "@/lib/admin/queries"
import { entidadTipo } from "@/db/schema"
import { fmtFechaRel } from "@/lib/admin/format"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"
import { ActividadForm } from "@/components/admin/actividades/actividad-form"

type EntidadTipo = (typeof entidadTipo.enumValues)[number]

export interface ActividadesPanelProps {
  entidadTipo: EntidadTipo
  entidadId: string
  actividades: ReadonlyArray<ClienteActividadRow>
  /** Vendedores asignables (para asignadoA). */
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC actividades:edit -> habilita alta, edición, completar y cancelar. */
  puedeEditar: boolean
  /** Solo admin: borrado permanente. */
  puedeEliminar?: boolean
}

/**
 * Panel de actividades de una entidad (cliente, lead, oportunidad, proyecto…).
 * Lista las actividades con su tipo, prioridad, estado, vencimiento y asignado;
 * permite completar/reabrir, cancelar/reactivar, editar y (admin) eliminar, y
 * dar de alta nuevas. La entidad viene dada por props (entidadFija en el form).
 */
export function ActividadesPanel({
  entidadTipo: tipoEntidad,
  entidadId,
  actividades,
  vendedores,
  puedeEditar,
  puedeEliminar = false,
}: ActividadesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // null = cerrado, "nuevo" = alta, <id> = edición de esa actividad.
  const [editando, setEditando] = useState<string | null>(null)

  function refrescar(): void {
    setEditando(null)
    router.refresh()
  }

  function alternarCompletar(id: string, completada: boolean): void {
    setError(null)
    startTransition(async () => {
      const res = await completarActividad(id, completada)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function alternarCancelar(id: string, cancelada: boolean): void {
    setError(null)
    startTransition(async () => {
      const res = await cancelarActividad(id, cancelada)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function borrar(id: string): void {
    setError(null)
    startTransition(async () => {
      const res = await eliminarActividad(id)
      if (!res.ok) setError(res.error)
      else router.refresh()
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
            <Button type="button" size="sm" onClick={() => setEditando("nuevo")}>
              <Plus className="size-4" aria-hidden /> Nueva actividad
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Alta */}
      {puedeEditar && editando === "nuevo" ? (
        <div className="rounded-xl border border-border p-4">
          <ActividadForm
            modo="crear"
            entidadFija={{ tipo: tipoEntidad, id: entidadId }}
            vendedores={vendedores}
            onSuccess={refrescar}
            onCancel={() => setEditando(null)}
          />
        </div>
      ) : null}

      {error ? <span className="text-sm text-destructive">{error}</span> : null}

      {/* Lista */}
      {actividades.length === 0 ? (
        <EmptyState
          title="Sin actividades"
          description="Aún no hay actividades registradas."
          size="sm"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {actividades.map((a) => {
            const completada = a.estado === "completada"
            const cancelada = a.estado === "cancelada"

            if (puedeEditar && editando === a.id) {
              return (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <ActividadForm
                    modo="editar"
                    entidadFija={{ tipo: tipoEntidad, id: entidadId }}
                    actividad={a}
                    vendedores={vendedores}
                    onSuccess={refrescar}
                    onCancel={() => setEditando(null)}
                  />
                </li>
              )
            }

            return (
              <li
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3",
                  cancelada && "opacity-60",
                )}
              >
                {puedeEditar && !cancelada ? (
                  <input
                    type="checkbox"
                    checked={completada}
                    onChange={(e) => alternarCompletar(a.id, e.target.checked)}
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
                        (completada || cancelada) &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {a.titulo}
                    </span>
                    <StatusBadge value={a.tipo} tone="neutral" />
                    <StatusBadge value={a.prioridad} />
                    <StatusBadge value={a.estado} />
                  </div>

                  {a.descripcion ? (
                    <p className="mt-1 text-sm text-muted-foreground">{a.descripcion}</p>
                  ) : null}

                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <dt>Vence:</dt>
                      <dd
                        className={cn(
                          "tabular-nums",
                          a.vencida && "font-medium text-destructive",
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

                {/* Acciones */}
                {puedeEditar ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      title="Editar"
                      onClick={() => setEditando(a.id)}
                      disabled={pending}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </IconBtn>
                    {cancelada ? (
                      <IconBtn
                        title="Reactivar"
                        onClick={() => alternarCancelar(a.id, false)}
                        disabled={pending}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                      </IconBtn>
                    ) : (
                      <IconBtn
                        title="Cancelar"
                        onClick={() => alternarCancelar(a.id, true)}
                        disabled={pending}
                      >
                        <XCircle className="size-4" aria-hidden />
                      </IconBtn>
                    )}
                    {puedeEliminar ? (
                      <IconBtn
                        title="Eliminar"
                        onClick={() => borrar(a.id)}
                        disabled={pending}
                        destructive
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconBtn>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function IconBtn({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
        destructive
          ? "text-stone-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          : "text-stone-500 hover:bg-stone-100 dark:text-muted-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
