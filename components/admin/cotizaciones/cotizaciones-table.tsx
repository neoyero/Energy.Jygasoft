"use client"

import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"

import type { CotizacionRow } from "@/lib/admin/queries"
import { fmtFechaRel, formatMXN } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"

export interface CotizacionesTableProps {
  rows: ReadonlyArray<CotizacionRow>
}

/**
 * Tabla del listado de cotizaciones sobre DataTable<CotizacionRow>. Datos ya
 * filtrados en el contenedor (CotizacionesView). Click en fila abre el detalle.
 */
export function CotizacionesTable({ rows }: CotizacionesTableProps) {
  const router = useRouter()

  const columns: ReadonlyArray<DataTableColumn<CotizacionRow>> = [
    {
      id: "folio",
      header: "Folio",
      accessor: (row) => row.folio ?? "",
      render: (row) => (
        <span className="font-medium text-stone-800 dark:text-foreground">
          {row.folio ?? "—"}
        </span>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessor: (row) => row.clienteNombre ?? "",
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.clienteNombre ?? "—"}
        </span>
      ),
    },
    {
      id: "version",
      header: "Version",
      accessor: (row) => row.version,
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-nums text-stone-600 dark:text-muted-foreground">
          v{row.version}
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      accessor: (row) => row.total,
      sortable: true,
      align: "end",
      className: "tabular-nums",
      render: (row) => (
        <span className="font-medium text-stone-800 dark:text-foreground">
          {formatMXN(row.total)}
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (row) => row.estado,
      sortable: true,
      render: (row) => <StatusBadge value={row.estado} />,
    },
    {
      id: "validaHasta",
      header: "Valida hasta",
      accessor: (row) => row.validaHasta ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {fmtFechaRel(row.validaHasta)}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Creada",
      accessor: (row) => row.createdAt,
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {fmtFechaRel(row.createdAt)}
        </span>
      ),
    },
  ]

  function irADetalle(row: CotizacionRow): void {
    router.push(`/je-admin/cotizaciones/${row.id}`)
  }

  return (
    <DataTable<CotizacionRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={irADetalle}
      defaultSort={{ columnId: "createdAt", direction: "desc" }}
      empty={{
        icon: FileText,
        title: "Sin cotizaciones",
        description:
          "No hay cotizaciones que coincidan con los filtros actuales.",
      }}
    />
  )
}
