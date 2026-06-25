import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export interface Breadcrumb {
  label: string
  /** Si falta href, es el item actual (no enlazado). */
  href?: string
}

export interface PageHeaderProps {
  /** Titulo principal (h1). */
  title: ReactNode
  /** Descripcion/subtitulo opcional. */
  description?: ReactNode
  /** Acciones a la derecha (botones, menus). */
  actions?: ReactNode
  /** Migas de pan opcionales (ultima = pagina actual). */
  breadcrumbs?: ReadonlyArray<Breadcrumb>
  /** Icono lucide opcional junto al titulo. */
  icon?: ReactNode
  /** Slot inferior opcional (Tabs/filtros que viven bajo el header). */
  children?: ReactNode
  className?: string
}

/**
 * Encabezado consistente para las paginas del panel admin.
 * Server component (compatible con RSC): breadcrumb opcional, titulo h1,
 * descripcion y slot de acciones a la derecha. Unifica jerarquia y spacing.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  icon,
  children,
  className,
}: PageHeaderProps) {
  const hasBreadcrumbs = breadcrumbs && breadcrumbs.length > 0

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {/* Migas de pan opcionales (ultima = pagina actual, sin enlace) */}
      {hasBreadcrumbs ? (
        <nav
          aria-label="Migas de pan"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1
            const isCurrent = isLast || !crumb.href

            return (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                ) : null}
                {isCurrent ? (
                  <span className="text-foreground/80" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href ?? "#"}
                    className="transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>
      ) : null}

      {/* Fila titulo + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-brand dark:text-foreground">
            {icon ? (
              <span className="flex shrink-0 items-center" aria-hidden>
                {icon}
              </span>
            ) : null}
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {/* Slot inferior opcional (tabs/filtros bajo el header) */}
      {children ? <div className="mt-1">{children}</div> : null}
    </header>
  )
}
