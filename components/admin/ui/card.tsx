import type { ReactNode, HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export type CardPadding = "none" | "sm" | "md" | "lg"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Densidad del padding interior. Default: "md" (p-5). none=p-0, sm=p-4, lg=p-6. */
  padding?: CardPadding
  /** Resalta el borde/sombra al pasar el mouse (filas/tarjetas clicables). Default false. */
  interactive?: boolean
  /** Elimina la sombra (para cards anidadas dentro de otra superficie). Default false. */
  flush?: boolean
  className?: string
  children?: ReactNode
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Slot a la derecha del header (acciones, menu, badge). */
  action?: ReactNode
  className?: string
  children?: ReactNode
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Nivel semantico del heading. Default "h3". */
  as?: "h2" | "h3" | "h4"
  className?: string
  children?: ReactNode
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  className?: string
  children?: ReactNode
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: ReactNode
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: ReactNode
}

/** Mapa de densidad de padding interior de la card. */
const paddingMap: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
}

/**
 * Card: superficie blanca base del back-office (borde stone-200, rounded-2xl,
 * sombra suave). Bloque visual reutilizado por StatCard, ChartCard, DataTable,
 * EmptyState y secciones de detalle.
 */
function Card({
  padding = "md",
  interactive = false,
  flush = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-2xl border border-stone-200/70 bg-white text-stone-900",
        "dark:border-border dark:bg-card dark:text-card-foreground",
        flush ? "shadow-none" : "shadow-sm",
        interactive && "transition-colors hover:border-stone-300 hover:shadow-md",
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Encabezado de la card: titulo/descripcion a la izquierda y acciones a la derecha. */
function CardHeader({ action, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-start justify-between gap-3",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** Titulo de la card (heading semantico configurable via `as`). */
function CardTitle({ as = "h3", className, children, ...props }: CardTitleProps) {
  const Heading = as
  return (
    <Heading
      data-slot="card-title"
      className={cn(
        "text-sm font-semibold tracking-tight text-brand dark:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Heading>
  )
}

/** Texto secundario bajo el titulo de la card. */
function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
}

/** Cuerpo principal de la card. */
function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div
      data-slot="card-content"
      className={cn("text-sm text-stone-700 dark:text-foreground", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Pie de la card (acciones, totales, metadatos). */
function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
