import type { ComponentType, ReactNode } from "react"
import type { LucideProps } from "lucide-react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  /** Icono lucide (componente). Default Inbox. */
  icon?: ComponentType<LucideProps>
  /** Titulo corto, ej. "Aun no hay clientes". */
  title: ReactNode
  /** Descripcion/guia opcional. */
  description?: ReactNode
  /** Accion principal opcional (normalmente <Button/>). */
  action?: ReactNode
  /** Densidad vertical. Default "md". "sm" para celdas de tabla. */
  size?: "sm" | "md" | "lg"
  className?: string
}

// Padding vertical por densidad. "sm" para celdas de DataTable.
const sizePadding: Record<NonNullable<EmptyStateProps["size"]>, string> = {
  sm: "py-8",
  md: "py-12",
  lg: "py-16",
}

/**
 * Estado vacio reutilizable: icono lucide en circulo de marca, titulo,
 * descripcion y accion opcional. Server component (sin hooks).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        sizePadding[size],
        className
      )}
    >
      {/* Icono en circulo con tono de marca (modo claro/oscuro) */}
      <div className="grid size-11 place-items-center rounded-full bg-brand/5 text-brand dark:bg-muted dark:text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>

      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>

      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
