"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, UserPlus, UserMinus } from "lucide-react"

import type { LeadRow, VendedorOption } from "@/lib/admin/queries"
import { asignarLead } from "@/lib/admin/actions"
import { fmtFechaRel } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { CanalIcon } from "@/components/admin/leads/canal-icon"
import { ScoreBar } from "@/components/admin/leads/score-bar"

export interface LeadsTableProps {
  rows: ReadonlyArray<LeadRow>
  /** Habilita el menu de acciones por fila (RBAC leads:edit). */
  puedeEditar: boolean
  /** Vendedores para el submenu "Asignar". */
  vendedores: ReadonlyArray<VendedorOption>
}

/**
 * Tabla del listado de leads sobre DataTable<LeadRow>. Datos ya filtrados en el
 * contenedor (LeadsView). Click en fila abre el detalle; el menu por fila
 * permite ver detalle y reasignar (server action asignarLead) cuando el rol
 * tiene permiso de edicion.
 */
export function LeadsTable({ rows, puedeEditar, vendedores }: LeadsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const columns: ReadonlyArray<DataTableColumn<LeadRow>> = [
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
      id: "segmento",
      header: "Segmento",
      accessor: (row) => row.segmento ?? "",
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {row.segmento ?? "—"}
        </span>
      ),
    },
    {
      id: "canal",
      header: "Canal",
      accessor: (row) => row.canal ?? "",
      hideOnMobile: true,
      render: (row) =>
        row.canal ? (
          <span className="inline-flex items-center gap-1.5">
            <CanalIcon canal={row.canal} />
            <StatusBadge value={row.canal} withDot={false} />
          </span>
        ) : (
          <span className="text-stone-400 dark:text-muted-foreground">—</span>
        ),
    },
    {
      id: "score",
      header: "Score",
      accessor: (row) => row.score,
      sortable: true,
      className: "w-36",
      render: (row) => <ScoreBar score={row.score} />,
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (row) => row.estado,
      sortable: true,
      render: (row) => <StatusBadge value={row.estado} />,
    },
    {
      id: "vendedor",
      header: "Asesor",
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

  function irADetalle(row: LeadRow): void {
    router.push(`/je-admin/leads/${row.id}`)
  }

  // Reasigna un lead (o lo deja sin asignar) via server action en transicion.
  function reasignar(leadId: string, vendedorId: string | null): void {
    startTransition(async () => {
      try {
        await asignarLead(leadId, vendedorId)
        router.refresh()
      } catch {
        // El detalle del error se registra del lado servidor; aqui no rompemos UI.
      }
    })
  }

  // Construye el menu de acciones por fila solo si el rol puede editar.
  const rowActions: ReadonlyArray<DataTableRowAction<LeadRow>> | undefined =
    puedeEditar
      ? [
          {
            label: "Ver detalle",
            icon: <Eye className="size-4" />,
            onSelect: irADetalle,
          },
          {
            label: "Quitar asignación",
            icon: <UserMinus className="size-4" />,
            destructive: true,
            onSelect: (row) => reasignar(row.id, null),
            hidden: (row) => row.vendedorId === null,
            confirm: {
              title: "Quitar asignación",
              description: (row) => (
                <>
                  El lead{" "}
                  <strong>{row.nombre ?? "sin nombre"}</strong> quedará{" "}
                  <strong>sin vendedor asignado</strong>. ¿Continuar?
                </>
              ),
              confirmLabel: "Quitar asignación",
            },
          },
          ...vendedores.map<DataTableRowAction<LeadRow>>((vendedor) => ({
            label: `Asignar: ${vendedor.nombre}`,
            icon: <UserPlus className="size-4" />,
            onSelect: (row) => reasignar(row.id, vendedor.id),
            hidden: (row) => row.vendedorId === vendedor.id,
            confirm: {
              title: "Asignar lead",
              description: (row: LeadRow) => (
                <>
                  El lead <strong>{row.nombre ?? "sin nombre"}</strong> se
                  asignará a <strong>{vendedor.nombre}</strong>. ¿Continuar?
                </>
              ),
              confirmLabel: "Asignar",
            },
          })),
        ]
      : undefined

  return (
    <div aria-busy={isPending}>
      <DataTable<LeadRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={irADetalle}
        rowActions={rowActions}
        pageSize={12}
        defaultSort={{ columnId: "createdAt", direction: "desc" }}
        empty={{
          title: "Sin leads",
          description: "No hay leads que coincidan con los filtros actuales.",
        }}
      />
    </div>
  )
}
