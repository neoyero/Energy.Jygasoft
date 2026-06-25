"use client"

import { useState, type ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog"

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
type ButtonSize = VariantProps<typeof buttonVariants>["size"]

export interface ConfirmButtonProps {
  /** Handler que se ejecuta SOLO tras confirmar en el modal. */
  onConfirm: () => void
  /** Título del modal de confirmación. */
  title: string
  /** Texto explicativo del modal. */
  description?: ReactNode
  /** Etiqueta del botón de confirmar (dentro del modal). Default "Confirmar". */
  confirmLabel?: string
  /** Etiqueta del botón cancelar. Default "Cancelar". */
  cancelLabel?: string
  /** Tono destructivo del modal. Si no se pasa, se infiere de variant. */
  destructive?: boolean
  /** Contenido del botón disparador. */
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  className?: string
  /** Accesibilidad para botones de solo-icono. */
  "aria-label"?: string
}

/**
 * Botón que exige confirmación en un modal antes de ejecutar su acción. Encapsula
 * el estado de apertura del ConfirmDialog para que cada acción de alto impacto
 * (enviar, convertir, borrar, activar/desactivar, etc.) sea de una sola línea.
 */
export function ConfirmButton({
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  children,
  variant = "default",
  size = "default",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false)
  const esDestructivo = destructive ?? variant === "destructive"

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        {children}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={esDestructivo}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}
