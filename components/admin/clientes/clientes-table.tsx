"use client"

import { useRouter } from "next/navigation"

import type { ClienteRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"

export interface ClientesTableProps {
  rows: ReadonlyArray<ClienteRow>
}

/**
 * Tabla del listado de clientes sobre DataTable<ClienteRow>. Datos ya filtrados
 * en el contenedor (ClientesView). Click en fila abre el detalle 360.
 */
export function ClientesTable({ rows }: ClientesTableProps) {
  const router = useRouter()

  function irADetalle(row: ClienteRow): void {
    router.push(`/je-admin/clientes/${row.id}`)
  }

  const columns: ReadonlyArray<DataTableColumn<ClienteRow>> = [
    {
      id: "tipo",
      header: "Tipo",
      accessor: (row) => row.tipoPersona,
      render: (row) => <StatusBadge value={row.tipoPersona} withDot={false} />,
    },
    {
      id: "nombre",
      header: "Nombre",
      accessor: (row) => row.nombre ?? "",
      render: (row) => (
        <span className="font-medium text-stone-800 dark:text-foreground">
          {row.nombre ?? "Sin nombre"}
        </span>
      ),
    },
    {
      id: "rfc",
      header: "RFC",
      accessor: (row) => row.rfc ?? "",
      render: (row) => (
        <span className="text-stone-600 tabular-nums dark:text-muted-foreground">
          {row.rfc ?? "—"}
        </span>
      ),
    },
    {
      id: "contacto",
      header: "Contacto",
      accessor: (row) => row.telefono ?? row.email ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.telefono ?? row.email ?? "—"}
        </span>
      ),
    },
    {
      id: "municipio",
      header: "Municipio",
      accessor: (row) => row.municipio ?? "",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.municipio ?? "—"}
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
      header: "Alta",
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
    <DataTable<ClienteRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={irADetalle}
      defaultSort={{ columnId: "createdAt", direction: "desc" }}
      empty={{
        title: "Sin clientes",
        description:
          "No hay clientes que coincidan con los filtros actuales.",
      }}
    />
  )
}
