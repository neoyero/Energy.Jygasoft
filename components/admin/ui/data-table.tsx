"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Menu } from "@base-ui/react/menu"
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  MoreHorizontal,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/admin/ui/card"
import { EmptyState, type EmptyStateProps } from "@/components/admin/ui/empty-state"

export type SortDirection = "asc" | "desc"

export type ColumnAlign = "start" | "center" | "end"

export interface DataTableColumn<T> {
  /** Id estable de columna (key de orden y de React). */
  id: string
  /** Encabezado (texto o nodo). */
  header: ReactNode
  /**
   * Acceso al valor: clave de T o funcion. Usado para orden por defecto y,
   * si no hay render, para mostrar el valor.
   */
  accessor?: keyof T | ((row: T) => unknown)
  /** Render custom de celda (tiene prioridad sobre accessor para mostrar). */
  render?: (row: T, rowIndex: number) => ReactNode
  /** Habilita orden por esta columna. Requiere accessor. Default false. */
  sortable?: boolean
  /** Comparador custom (sino, comparacion natural string/number/Date). */
  sortFn?: (a: T, b: T) => number
  /** Alineacion del contenido. Default "start". */
  align?: ColumnAlign
  /** Clase extra para <th>/<td> de la columna (ancho, tabular-nums, etc.). */
  className?: string
  /** Oculta la columna en pantallas pequenas (aplica hidden md:table-cell). */
  hideOnMobile?: boolean
}

export interface DataTableRowAction<T> {
  /** Etiqueta accesible/visible del item. */
  label: string
  /** Icono lucide opcional. */
  icon?: ReactNode
  /** Handler de la accion. */
  onSelect: (row: T) => void
  /** Tono destructivo (rojo) para borrar. Default false. */
  destructive?: boolean
  /** Oculta condicionalmente la accion segun la fila. */
  hidden?: (row: T) => boolean
}

export interface DataTableSort {
  columnId: string
  direction: SortDirection
}

export interface DataTableProps<T> {
  /** Datos ya resueltos (RSC -> client). */
  data: ReadonlyArray<T>
  /** Definicion de columnas. */
  columns: ReadonlyArray<DataTableColumn<T>>
  /** Clave estable por fila (id de BD). */
  rowKey: (row: T) => string
  /** Click en la fila (abrir drawer/detalle). */
  onRowClick?: (row: T) => void
  /** Menu de acciones por fila (columna final con kebab). */
  rowActions?: ReadonlyArray<DataTableRowAction<T>>
  /** Orden inicial (no controlado). */
  defaultSort?: DataTableSort
  /** Orden controlado (opcional). */
  sort?: DataTableSort
  onSortChange?: (sort: DataTableSort | undefined) => void
  /** Estado de carga -> filas skeleton. Default false. */
  loading?: boolean
  /** Numero de filas skeleton mientras loading. Default 5. */
  skeletonRows?: number
  /** Config del estado vacio (se pasa a <EmptyState />). */
  empty?: EmptyStateProps
  /** Densidad de fila. Default "comfortable". */
  density?: "comfortable" | "compact"
  /** Envolver en Card del kit. Default true. */
  bordered?: boolean
  className?: string
}

// Clases de alineacion horizontal para <th>/<td>.
const alignText: Record<ColumnAlign, string> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
}

// Alineacion del contenido flex (usado en la celda de acciones).
const alignJustify: Record<ColumnAlign, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
}

/** Lee el valor crudo de una fila segun el accessor (clave o funcion). */
function readValue<T>(row: T, accessor: DataTableColumn<T>["accessor"]): unknown {
  if (accessor === undefined) return undefined
  if (typeof accessor === "function") return accessor(row)
  return row[accessor]
}

/** Comparacion natural: number, Date, string (localeCompare es-MX) y fallback. */
function naturalCompare(a: unknown, b: unknown): number {
  // Nulos al final, sin importar la direccion logica del comparador.
  const aNil = a === null || a === undefined
  const bNil = b === null || b === undefined
  if (aNil && bNil) return 0
  if (aNil) return 1
  if (bNil) return -1

  if (typeof a === "number" && typeof b === "number") return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b)
  }

  return String(a).localeCompare(String(b), "es-MX", {
    numeric: true,
    sensitivity: "base",
  })
}

/** Indicador de orden en la cabecera segun el estado de la columna. */
function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === "asc") return <ChevronUp className="size-3.5" aria-hidden />
  if (direction === "desc") return <ChevronDown className="size-3.5" aria-hidden />
  return <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
}

/**
 * DataTable: tabla generica y tipada del back-office. Recibe datos ya resueltos
 * (la pagina RSC los pasa) y resuelve orden por columna en cliente. Soporta
 * render custom de celdas, filas clicables, menu de acciones por fila, estado de
 * carga (skeleton) y estado vacio integrado (EmptyState).
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  rowActions,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  loading = false,
  skeletonRows = 5,
  empty,
  density = "comfortable",
  bordered = true,
  className,
}: DataTableProps<T>) {
  // Estado de orden no controlado (si no se pasa `sort` desde fuera).
  const [internalSort, setInternalSort] = useState<DataTableSort | undefined>(
    defaultSort
  )
  const isControlled = controlledSort !== undefined || onSortChange !== undefined
  const sort = isControlled ? controlledSort : internalSort

  const hasActions = Boolean(rowActions && rowActions.length > 0)
  const totalCols = columns.length + (hasActions ? 1 : 0)
  const isClickable = typeof onRowClick === "function"

  // Mapa id -> columna para resolver el comparador del orden activo.
  const columnById = useMemo(() => {
    const map = new Map<string, DataTableColumn<T>>()
    for (const col of columns) map.set(col.id, col)
    return map
  }, [columns])

  // Datos ordenados en cliente. Sin orden activo, respeta el orden recibido.
  const sortedData = useMemo(() => {
    if (!sort) return data
    const column = columnById.get(sort.columnId)
    if (!column) return data

    const factor = sort.direction === "asc" ? 1 : -1
    const compare =
      column.sortFn ??
      ((a: T, b: T) =>
        naturalCompare(readValue(a, column.accessor), readValue(b, column.accessor)))

    // Copia (immutabilidad): no mutamos el array recibido.
    return [...data].sort((a, b) => factor * compare(a, b))
  }, [data, sort, columnById])

  // Ciclo de orden por columna: none -> asc -> desc -> none.
  function handleSort(column: DataTableColumn<T>): void {
    if (!column.sortable || column.accessor === undefined) return

    let next: DataTableSort | undefined
    if (!sort || sort.columnId !== column.id) {
      next = { columnId: column.id, direction: "asc" }
    } else if (sort.direction === "asc") {
      next = { columnId: column.id, direction: "desc" }
    } else {
      next = undefined
    }

    if (isControlled) onSortChange?.(next)
    else setInternalSort(next)
  }

  // Padding vertical de celda segun densidad.
  const cellPadY = density === "compact" ? "py-2" : "py-3"

  const showEmpty = !loading && sortedData.length === 0

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-stone-200 bg-stone-50/60 text-left dark:border-border dark:bg-muted/40">
          <tr>
            {columns.map((column) => {
              const align = column.align ?? "start"
              const canSort = Boolean(column.sortable && column.accessor !== undefined)
              const activeDir =
                sort && sort.columnId === column.id ? sort.direction : null

              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    canSort
                      ? activeDir === "asc"
                        ? "ascending"
                        : activeDir === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-muted-foreground",
                    alignText[align],
                    column.hideOnMobile && "hidden md:table-cell",
                    column.className
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded transition-colors hover:text-stone-700 dark:hover:text-foreground",
                        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        align === "center" && "mx-auto",
                        align === "end" && "ml-auto"
                      )}
                    >
                      <span>{column.header}</span>
                      <SortIcon direction={activeDir} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}

            {hasActions ? (
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-muted-foreground"
              >
                <span className="sr-only">Acciones</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {/* Estado de carga: filas skeleton */}
          {loading
            ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr
                  key={`skeleton-${rowIndex}`}
                  className="border-b border-stone-100 last:border-0 dark:border-border/60"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 text-sm",
                        cellPadY,
                        column.hideOnMobile && "hidden md:table-cell"
                      )}
                    >
                      <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200/70 dark:bg-muted" />
                    </td>
                  ))}
                  {hasActions ? (
                    <td className={cn("px-4 text-right", cellPadY)}>
                      <div className="ml-auto size-7 animate-pulse rounded-md bg-stone-200/70 dark:bg-muted" />
                    </td>
                  ) : null}
                </tr>
              ))
            : null}

          {/* Estado vacio: ocupa todas las columnas */}
          {showEmpty ? (
            <tr>
              <td colSpan={totalCols} className="px-4">
                <EmptyState
                  size="sm"
                  title="Sin resultados"
                  {...empty}
                />
              </td>
            </tr>
          ) : null}

          {/* Filas de datos */}
          {!loading && !showEmpty
            ? sortedData.map((row, rowIndex) => (
                <tr
                  key={rowKey(row)}
                  onClick={isClickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={
                    isClickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onRowClick?.(row)
                          }
                        }
                      : undefined
                  }
                  tabIndex={isClickable ? 0 : undefined}
                  className={cn(
                    "border-b border-stone-100 last:border-0 dark:border-border/60",
                    isClickable &&
                      "cursor-pointer transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none dark:hover:bg-muted/40 dark:focus-visible:bg-muted/40"
                  )}
                >
                  {columns.map((column) => {
                    const align = column.align ?? "start"
                    const content = column.render
                      ? column.render(row, rowIndex)
                      : (readValue(row, column.accessor) as ReactNode)

                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 text-sm text-stone-700 dark:text-foreground",
                          cellPadY,
                          alignText[align],
                          column.hideOnMobile && "hidden md:table-cell",
                          column.className
                        )}
                      >
                        {content}
                      </td>
                    )
                  })}

                  {hasActions ? (
                    <td className={cn("px-4 text-right", cellPadY)}>
                      <div className={cn("flex items-center", alignJustify.end)}>
                        <RowActionsMenu row={row} actions={rowActions ?? []} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  )

  if (!bordered) {
    return <div className={cn("overflow-x-auto", className)}>{table}</div>
  }

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      {table}
    </Card>
  )
}

/**
 * Menu de acciones por fila (kebab). Usa @base-ui/react Menu. Detiene la
 * propagacion para no disparar onRowClick de la fila contenedora.
 */
function RowActionsMenu<T>({
  row,
  actions,
}: {
  row: T
  actions: ReadonlyArray<DataTableRowAction<T>>
}) {
  // Filtra acciones ocultas condicionalmente para esta fila.
  const visible = actions.filter((action) => !action.hidden?.(row))
  if (visible.length === 0) return null

  return (
    <Menu.Root>
      <Menu.Trigger
        // Evita que el click abra el detalle de la fila.
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md text-stone-500 transition-colors",
          "hover:bg-stone-100 hover:text-stone-700 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "aria-expanded:bg-stone-100 dark:aria-expanded:bg-muted"
        )}
        aria-label="Abrir acciones de fila"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 outline-none"
        >
          <Menu.Popup
            // stopPropagation: clicks dentro del popup no llegan a la fila.
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "min-w-40 origin-[var(--transform-origin)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg",
              "text-sm text-stone-700 dark:border-border dark:bg-popover dark:text-popover-foreground",
              "outline-none"
            )}
          >
            {visible.map((action) => (
              <Menu.Item
                key={action.label}
                onClick={(event) => {
                  event.stopPropagation()
                  action.onSelect(row)
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 outline-none select-none",
                  "data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-muted",
                  action.destructive
                    ? "text-destructive data-[highlighted]:bg-destructive/10 dark:data-[highlighted]:bg-destructive/20"
                    : "text-stone-700 dark:text-popover-foreground"
                )}
              >
                {action.icon ? (
                  <span className="flex size-4 shrink-0 items-center" aria-hidden>
                    {action.icon}
                  </span>
                ) : null}
                <span>{action.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
