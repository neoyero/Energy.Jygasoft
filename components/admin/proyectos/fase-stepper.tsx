"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import { proyectoFase } from "@/db/schema"
import { avanzarFaseProyecto } from "@/lib/admin/actions"
import { labelFor } from "@/components/admin/ui/status-badge"
import { ConfirmButton } from "@/components/admin/ui/confirm-button"
import { cn } from "@/lib/utils"

// Orden canonico de fases. Se deriva del enum de schema (mismo orden que
// FASE_ORDER en queries) para NO arrastrar @/lib/admin/queries (y con el su
// dependencia de servidor @/db) a la frontera de cliente.
const FASE_ORDER = proyectoFase.enumValues

export interface FaseStepperProps {
  proyectoId: string
  fase: string
  /** RBAC proyectos:edit -> habilita avanzar/retroceder fase. */
  puedeEditar: boolean
}

/**
 * Stepper horizontal de fases de proyecto. Resalta la fase actual, marca las
 * previas en verde y deja las siguientes en gris. Si el rol puede editar,
 * permite avanzar/retroceder a la fase contigua via server action (la propia
 * action valida que la transición sea de un solo paso). Refresca al exito.
 */
export function FaseStepper({ proyectoId, fase, puedeEditar }: FaseStepperProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const indiceActual = FASE_ORDER.indexOf(fase as (typeof FASE_ORDER)[number])
  const faseAnterior = indiceActual > 0 ? FASE_ORDER[indiceActual - 1] : null
  const faseSiguiente =
    indiceActual >= 0 && indiceActual < FASE_ORDER.length - 1
      ? FASE_ORDER[indiceActual + 1]
      : null

  function cambiar(destino: (typeof FASE_ORDER)[number]): void {
    setError(null)
    startTransition(async () => {
      const res = await avanzarFaseProyecto(proyectoId, destino)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-stone-200/70 bg-white p-5 text-stone-900 shadow-sm dark:border-border dark:bg-card dark:text-card-foreground">
      {/* Pasos horizontales */}
      <ol className="flex flex-wrap items-center gap-2">
        {FASE_ORDER.map((f, i) => {
          const estado =
            i < indiceActual
              ? "completada"
              : i === indiceActual
                ? "actual"
                : "pendiente"

          return (
            <li key={f} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
                  estado === "completada" &&
                    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400",
                  estado === "actual" &&
                    "bg-brand/10 text-brand ring-brand/30 dark:bg-primary/15 dark:text-foreground dark:ring-primary/40",
                  estado === "pendiente" &&
                    "bg-stone-100 text-stone-500 ring-stone-500/20 dark:bg-muted dark:text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                    estado === "completada" &&
                      "bg-emerald-600 text-white dark:bg-emerald-500",
                    estado === "actual" &&
                      "bg-brand text-white dark:bg-primary dark:text-primary-foreground",
                    estado === "pendiente" &&
                      "bg-stone-300 text-stone-600 dark:bg-border dark:text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {estado === "completada" ? (
                    <Check className="size-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                {labelFor(f)}
              </div>
              {i < FASE_ORDER.length - 1 ? (
                <span
                  className="h-px w-4 bg-border"
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>

      {/* Controles de fase */}
      {puedeEditar ? (
        <div className="flex flex-wrap items-center gap-3">
          {faseAnterior ? (
            <ConfirmButton
              size="sm"
              variant="outline"
              disabled={pending}
              title="Retroceder fase"
              description={
                <>
                  El proyecto regresará a la fase{" "}
                  <strong>{labelFor(faseAnterior)}</strong>. ¿Continuar?
                </>
              }
              confirmLabel="Retroceder"
              onConfirm={() => cambiar(faseAnterior)}
            >
              Retroceder
            </ConfirmButton>
          ) : null}

          {faseSiguiente ? (
            <ConfirmButton
              size="sm"
              disabled={pending}
              title="Avanzar fase"
              description={
                <>
                  El proyecto avanzará a la fase{" "}
                  <strong>{labelFor(faseSiguiente)}</strong>. ¿Continuar?
                </>
              }
              confirmLabel="Avanzar"
              onConfirm={() => cambiar(faseSiguiente)}
            >
              Avanzar fase
            </ConfirmButton>
          ) : null}

          {error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
