"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Dialog } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

export interface ModalProps {
  /** Estado controlado de apertura. */
  open: boolean
  /** Notifica cambios de apertura (cerrar = false). */
  onOpenChange: (open: boolean) => void
  /** Título del modal (encabezado fijo). */
  title: string
  /** Descripción opcional bajo el título. */
  description?: ReactNode
  /** Contenido (cuerpo desplazable). */
  children: ReactNode
  /** Ancho máximo en escritorio. Default "2xl". */
  size?: "md" | "lg" | "xl" | "2xl" | "3xl"
  /** Bloquea el cierre por backdrop/ESC (p. ej. mientras guarda). Default false. */
  dismissable?: boolean
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
}

/**
 * Modal de contenido genérico (Dialog de base-ui) con estilos del kit admin.
 * Responsive: en móvil ocupa casi toda la pantalla (con márgenes) y el cuerpo se
 * desplaza; en escritorio se centra con un ancho máximo. Encabezado fijo con
 * título y botón de cierre; el cuerpo (children) hace scroll si excede el alto.
 * Controlado: el contenedor maneja `open`/`onOpenChange`.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "2xl",
  dismissable = true,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      modal
      // Si no es descartable (p. ej. mientras guarda), ignora TODO cierre por
      // gesto: disablePointerDismissal cubre el click fuera; el guard de
      // onOpenChange cubre además la tecla ESC (que ese prop no bloquea).
      disablePointerDismissal={!dismissable}
      onOpenChange={(abierto) => {
        if (!dismissable && !abierto) return
        onOpenChange(abierto)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity duration-150",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          onClick={(event) => event.stopPropagation()}
          className={cn(
            // Posición: centrado; en móvil con márgenes laterales.
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col",
            SIZE_CLASS[size],
            "rounded-2xl border border-stone-200 bg-white shadow-xl outline-none",
            "dark:border-border dark:bg-popover",
            "transition-all duration-150",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
          )}
        >
          {/* Encabezado fijo */}
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 dark:border-border">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-stone-900 dark:text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-stone-600 dark:text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className={cn(
                "shrink-0 rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "dark:text-muted-foreground dark:hover:bg-muted",
              )}
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          {/* Cuerpo desplazable. flex-1 + min-h-0: imprescindible para que el
              scroll funcione cuando el contenido excede el alto máximo del modal
              (sin min-h-0 el hijo flex no se encoge y el scroll no aparece). */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
