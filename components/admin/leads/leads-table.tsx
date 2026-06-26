"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, UserPlus, UserMinus } from "lucide-react"

import type {
  FetchLeadsFiltros,
  LeadRow,
  LeadsPage,
  VendedorOption,
} from "@/lib/admin/queries"
import { asignarLead, fetchLeads } from "@/lib/admin/actions"
import { fmtFechaRel } from "@/lib/admin/format"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { CanalIcon } from "@/components/admin/leads/canal-icon"
import { ScoreBar } from "@/components/admin/leads/score-bar"

const PAGE_SIZE = 12

export interface LeadsTableProps {
  /** Filtros activos (server-side); cambia => recarga desde la página 1. */
  filtros: FetchLeadsFiltros
  /** Habilita el menu de acciones por fila (RBAC leads:edit). */
  puedeEditar: boolean
  /** Asesores para el submenu "Asignar". */
  vendedores: ReadonlyArray<VendedorOption>
}

/**
 * Tabla del listado de leads con paginación SERVER-SIDE: cada página se trae con
 * fetchLeads (limit/offset). Al cambiar los filtros vuelve a la página 1. El
 * menu por fila permite ver detalle y reasignar (a un asesor).
 */
export function LeadsTable({ filtros, puedeEditar, vendedores }: LeadsTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeadsPage>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)

  // Clave estable de los filtros para los efectos (el objeto cambia de identidad
  // en cada render del contenedor).
  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number): Promise<LeadsPage> =>
      fetchLeads({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
    // filtros se captura por closure; filtrosKey es la dependencia estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey],
  )

  // Al cambiar los filtros, vuelve a la página 1.
  useEffect(() => {
    setPage(1)
  }, [filtrosKey])

  // Carga la página actual (con guard anti-carrera).
  useEffect(() => {
    let stale = false
    setLoading(true)
    fetchPage(page)
      .then((res) => {
        if (!stale) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [fetchPage, page])

  function irADetalle(row: LeadRow): void {
    router.push(`/je-admin/leads/${row.id}`)
  }

  // Reasigna y recarga la página actual.
  function reasignar(leadId: string, vendedorId: string | null): void {
    startTransition(async () => {
      try {
        await asignarLead(leadId, vendedorId)
        const res = await fetchPage(page)
        setData(res)
        router.refresh()
      } catch {
        // El detalle del error se registra del lado servidor; aqui no rompemos UI.
      }
    })
  }

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
      className: "w-36",
      render: (row) => <ScoreBar score={row.score} />,
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (row) => row.estado,
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
      hideOnMobile: true,
      render: (row) => (
        <span className="text-stone-600 dark:text-muted-foreground">
          {fmtFechaRel(row.createdAt)}
        </span>
      ),
    },
  ]

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
                  El lead <strong>{row.nombre ?? "sin nombre"}</strong> quedará{" "}
                  <strong>sin asesor asignado</strong>. ¿Continuar?
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

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <DataTable<LeadRow>
      data={data.rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={irADetalle}
      rowActions={rowActions}
      loading={loading}
      mobileCard={(row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-stone-800 dark:text-foreground">
              {row.nombre ?? "Sin nombre"}
            </span>
            <StatusBadge value={row.estado} withDot={false} />
          </div>
          <p className="text-xs text-stone-600 dark:text-muted-foreground">
            {row.telefono ?? row.email ?? "—"}
          </p>
          {row.canal ? (
            <span className="inline-flex items-center gap-1.5">
              <CanalIcon canal={row.canal} />
              <StatusBadge value={row.canal} size="sm" withDot={false} />
            </span>
          ) : null}
          <ScoreBar score={row.score} />
          <p className="text-xs text-stone-500 dark:text-muted-foreground">
            {row.vendedorNombre ?? "Sin asignar"} · {fmtFechaRel(row.createdAt)}
          </p>
        </div>
      )}
      pageControl={{
        page,
        pageCount,
        total: data.total,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
      }}
      empty={{
        title: "Sin leads",
        description: "No hay leads que coincidan con los filtros actuales.",
      }}
    />
  )
}
