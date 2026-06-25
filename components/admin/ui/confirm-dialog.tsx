"use client"

import type { ReactNode } from "react"
import { AlertDialog } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ConfirmDialogProps {
  /** Estado controlado de apertura. */
  open: boolean
  /** Notifica cambios de apertura (cerrar = false). */
  onOpenChange: (open: boolean) => void
  /** Título corto de la confirmación. */
  title: string
  /** Texto explicativo opcional (qué va a pasar). */
  description?: ReactNode
  /** Etiqueta del botón de confirmación. Default "Confirmar". */
  confirmLabel?: string
  /** Etiqueta del botón de cancelar. Default "Cancelar". */
  cancelLabel?: string
  /** Tono destructivo (rojo) para acciones peligrosas. Default false. */
  destructive?: boolean
  /** Deshabilita los botones mientras la acción está en curso. */
  pending?: boolean
  /** Handler al confirmar. */
  onConfirm: () => void
}

/**
 * Diálogo de confirmación accesible (AlertDialog de base-ui) con estilos del
 * kit admin. Controlado: el contenedor maneja `open`/`onOpenChange`. Pensado
 * para envolver acciones que mutan datos (asignar, convertir, borrar, etc.).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          // stopPropagation: el diálogo se renderiza en un portal, pero los
          // eventos de React burbujean por el árbol de componentes; sin esto un
          // click dentro del modal llegaría a contenedores clicables (p. ej. la
          // fila de la tabla con onRowClick) y dispararía navegación indebida.
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity duration-150",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <AlertDialog.Popup
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-stone-200 bg-white p-6 shadow-xl outline-none",
            "dark:border-border dark:bg-popover",
            "transition-all duration-150",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          )}
        >
          <AlertDialog.Title className="text-base font-semibold text-stone-900 dark:text-foreground">
            {title}
          </AlertDialog.Title>

          {description ? (
            <AlertDialog.Description className="mt-2 text-sm text-stone-600 dark:text-muted-foreground">
              {description}
            </AlertDialog.Description>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              size="sm"
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
