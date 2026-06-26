"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, FileText, Pencil, Receipt, X } from "lucide-react"

import type { PagoRow } from "@/lib/admin/queries"
import {
  marcarPagoPagado,
  registrarCfdiPago,
  cancelarPago,
} from "@/lib/admin/actions"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"

export interface PagosTableProps {
  rows: ReadonlyArray<PagoRow>
  /** RBAC pagos:edit -> habilita el menú de acciones por fila. */
  puedeEditar: boolean
  /** Abre el form de edición del pago seleccionado. */
  onEditar: (row: PagoRow) => void
}

/** Mensaje de error seguro a partir de un error desconocido. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return "No se pudo completar la acción. Intenta de nuevo."
}

/**
 * Tabla del listado de pagos sobre DataTable<PagoRow>. Datos ya filtrados en el
 * contenedor (PagosView). Las acciones de estado corren en useTransition y, tras
 * éxito, refrescan la ruta (RSC) para reflejar el nuevo estado. El estado se
 * muestra como "vencido" cuando row.vencido aunque el enum siga en "programado".
 */
export function PagosTable({ rows, puedeEditar, onEditar }: PagosTableProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Ejecuta una acción de servidor (ActionResult) y refresca al tener éxito.
  function run(action: () => Promise<{ ok: boolean; error?: string }>): void {
    setError(null)
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          setError(res.error ?? "No se pudo completar la acción.")
          return
        }
        router.refresh()
      } catch (err: unknown) {
        setError(getErrorMessage(err))
      }
    })
  }

  // Registrar CFDI: prompt simple para capturar el UUID (fallback nativo).
  function pedirCfdi(row: PagoRow): void {
    const uuid = window.prompt("UUID del CFDI:", row.cfdiUuid ?? "")
    if (uuid === null) return
    const limpio = uuid.trim()
    if (limpio === "") return
    run(() => registrarCfdiPago(row.id, limpio))
  }

  const columns: ReadonlyArray<DataTableColumn<PagoRow>> = [
    {
      id: "concepto",
      header: "Concepto",
      accessor: (row) => row.concepto,
      render: (row) => (
        <span className="font-medium text-stone-800 dark:text-foreground">
          {row.concepto}
        </span>
      ),
    },
    {
      id: "proyecto",
      header: "Proyecto",
      accessor: (row) => row.proyectoFolio ?? "",
      render: (row) => (
        <span className="text-stone-600 tabular-nums dark:text-muted-foreground">
          {row.proyectoFolio ?? "—"}
        </span>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessor: (row) => row.clienteNombre ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.clienteNombre ?? "—"}
        </span>
      ),
    },
    {
      id: "monto",
      header: "Monto",
      accessor: (row) => row.monto,
      align: "end",
      sortable: true,
      className: "tabular-nums",
      render: (row) => (
        <span className="font-medium text-stone-800 dark:text-foreground">
          {formatMXN(row.monto)}
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (row) => (row.vencido ? "vencido" : row.estado),
      render: (row) =>
        row.vencido ? (
          <StatusBadge value="vencido" />
        ) : (
          <StatusBadge value={row.estado} />
        ),
    },
    {
      id: "programada",
      header: "Programada",
      accessor: (row) => row.fechaProgramada ?? "",
      hideOnMobile: true,
      sortable: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {fmtFechaRel(row.fechaProgramada)}
        </span>
      ),
    },
    {
      id: "cfdi",
      header: "CFDI",
      accessor: (row) => (row.cfdiUuid ? 1 : 0),
      align: "center",
      render: (row) =>
        row.cfdiUuid ? (
          <Check
            className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
            aria-label="CFDI registrado"
          />
        ) : (
          <span className="text-stone-400 dark:text-muted-foreground">—</span>
        ),
    },
  ]

  // Acciones por fila (solo si puedeEditar). hidden por estado terminal.
  const rowActions: ReadonlyArray<DataTableRowAction<PagoRow>> = [
    {
      label: "Editar",
      icon: <Pencil className="size-4" aria-hidden />,
      onSelect: (row) => onEditar(row),
    },
    {
      label: "Marcar pagado",
      icon: <Check className="size-4" aria-hidden />,
      hidden: (row) => row.estado === "pagado" || row.estado === "cancelado",
      confirm: {
        title: "Marcar como pagado",
        description: (row) =>
          `El pago «${row.concepto}» se marcará como pagado con fecha de hoy. ¿Continuar?`,
        confirmLabel: "Marcar pagado",
      },
      onSelect: (row) => run(() => marcarPagoPagado(row.id)),
    },
    {
      label: "Registrar CFDI",
      icon: <FileText className="size-4" aria-hidden />,
      hidden: (row) => row.estado === "cancelado",
      onSelect: (row) => pedirCfdi(row),
    },
    {
      label: "Cancelar",
      icon: <X className="size-4" aria-hidden />,
      destructive: true,
      hidden: (row) => row.estado === "pagado" || row.estado === "cancelado",
      confirm: {
        title: "Cancelar pago",
        description: (row) =>
          `El pago «${row.concepto}» se marcará como cancelado. Esta acción no se puede revertir. ¿Continuar?`,
        confirmLabel: "Cancelar pago",
      },
      onSelect: (row) => run(() => cancelarPago(row.id)),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <DataTable<PagoRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        rowActions={puedeEditar ? rowActions : undefined}
        pageSize={12}
        defaultSort={{ columnId: "programada", direction: "asc" }}
        empty={{
          icon: Receipt,
          title: "Sin pagos",
          description: "No hay pagos que coincidan con los filtros actuales.",
        }}
        className={pending ? "opacity-70 transition-opacity" : undefined}
      />
    </div>
  )
}
