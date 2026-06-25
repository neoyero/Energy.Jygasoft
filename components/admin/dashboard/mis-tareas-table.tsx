"use client"

import {
  CheckSquare,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"

import type { MiActividadRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { cn } from "@/lib/utils"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/ui/data-table"
import { StatusBadge } from "@/components/admin/ui/status-badge"

/**
 * Icono lucide por tipo de actividad. Default CheckSquare ante tipos nuevos.
 */
const TIPO_ICON: Record<string, LucideIcon> = {
  llamada: Phone,
  visita: MapPin,
  email: Mail,
  whatsapp: MessageCircle,
  tarea: CheckSquare,
  nota: StickyNote,
  reunion: Users,
}

/** Resuelve el icono de la actividad; fallback a CheckSquare. */
function iconForTipo(tipo: string): LucideIcon {
  return TIPO_ICON[tipo] ?? CheckSquare
}

/**
 * Mapa entidadTipo -> segmento de ruta del back-office. Las claves cubren las
 * entidades navegables; el resto (sin ruta) deja la fila como no-op.
 */
const TIPO_RUTA: Record<string, string> = {
  lead: "leads",
  oportunidad: "oportunidades",
  cliente: "clientes",
  proyecto: "proyectos",
}

/** Devuelve el segmento de ruta para un entidadTipo, o null si no aplica. */
function mapTipoRuta(entidadTipo: string): string | null {
  return TIPO_RUTA[entidadTipo] ?? null
}

/**
 * Tabla "Mis tareas" del dashboard: actividades pendientes del usuario,
 * ordenadas por fecha de vencimiento. Click en fila abre el detalle de la
 * entidad asociada (lead, oportunidad, cliente o proyecto) cuando existe.
 */
export function MisTareasTable({ rows }: { rows: MiActividadRow[] }) {
  const router = useRouter()

  const columns: ReadonlyArray<DataTableColumn<MiActividadRow>> = [
    {
      id: "titulo",
      header: "Tarea",
      accessor: "titulo",
      render: (row) => {
        const Icon = iconForTipo(row.tipo)
        return (
          <div className="flex items-center gap-2.5">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/5 text-brand dark:bg-muted dark:text-muted-foreground"
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <span className="font-medium text-stone-800 dark:text-foreground">
              {row.titulo}
            </span>
          </div>
        )
      },
    },
    {
      id: "tipo",
      header: "Tipo",
      accessor: "tipo",
      hideOnMobile: true,
      render: (row) => <StatusBadge value={row.tipo} />,
    },
    {
      id: "venceAt",
      header: "Vence",
      accessor: (row) => row.venceAt,
      sortable: true,
      render: (row) => {
        const rel = fmtFechaRel(row.venceAt)
        if (row.vencida) {
          return (
            <span className="font-medium text-destructive">
              {`Vencida · ${rel}`}
            </span>
          )
        }
        return (
          <span className="text-stone-600 dark:text-muted-foreground">
            {rel}
          </span>
        )
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessor: "estado",
      render: (row) => <StatusBadge value={row.estado} />,
    },
  ]

  function handleRowClick(row: MiActividadRow): void {
    if (!row.entidadTipo || !row.entidadId) return
    const segmento = mapTipoRuta(row.entidadTipo)
    if (!segmento) return
    router.push(`/je-admin/${segmento}/${row.entidadId}`)
  }

  return (
    <DataTable<MiActividadRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={handleRowClick}
      defaultSort={{ columnId: "venceAt", direction: "asc" }}
      empty={{
        title: "Sin tareas pendientes",
        description: "No tienes actividades por atender en este momento.",
      }}
    />
  )
}
