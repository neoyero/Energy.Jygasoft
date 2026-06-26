"use client"

import { useRouter } from "next/navigation"

import type { ProyectoRow } from "@/lib/admin/queries"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"

export interface ProyectosTableProps {
  rows: ReadonlyArray<ProyectoRow>
}

/**
 * Tabla del listado de proyectos sobre DataTable<ProyectoRow>. Datos ya
 * filtrados en el contenedor (ProyectosView). Click en fila abre el detalle.
 */
export function ProyectosTable({ rows }: ProyectosTableProps) {
  const router = useRouter()

  function irADetalle(row: ProyectoRow): void {
    router.push(`/je-admin/proyectos/${row.id}`)
  }

  const columns: ReadonlyArray<DataTableColumn<ProyectoRow>> = [
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
        <span className="text-stone-700 dark:text-foreground">
          {row.clienteNombre ?? "—"}
        </span>
      ),
    },
    {
      id: "fase",
      header: "Fase",
      accessor: (row) => row.fase,
      sortable: true,
      render: (row) => <StatusBadge value={row.fase} withDot={false} />,
    },
    {
      id: "capacidad",
      header: "Capacidad",
      accessor: (row) => row.capacidadKwp ?? 0,
      render: (row) => (
        <span className="text-stone-600 tabular-nums dark:text-muted-foreground">
          {row.capacidadKwp !== null ? `${row.capacidadKwp} kWp` : "—"}
        </span>
      ),
    },
    {
      id: "totalConIva",
      header: "Total c/IVA",
      accessor: (row) => row.totalConIva ?? 0,
      sortable: true,
      render: (row) => (
        <span className="text-stone-600 tabular-nums dark:text-muted-foreground">
          {row.totalConIva !== null ? formatMXN(row.totalConIva) : "—"}
        </span>
      ),
    },
    {
      id: "vendedor",
      header: "Vendedor",
      accessor: (row) => row.vendedorNombre ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.vendedorNombre ?? "Sin asignar"}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Creado",
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

  return (
    <DataTable<ProyectoRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={irADetalle}
      defaultSort={{ columnId: "createdAt", direction: "desc" }}
      pageSize={12}
      empty={{
        title: "Sin proyectos",
        description: "No hay proyectos que coincidan con los filtros.",
      }}
    />
  )
}
