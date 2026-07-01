import { Wallet, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import { getPagosData, getPagosFlujo, type DashboardScope } from "@/lib/admin/queries"
import { formatMXN } from "@/lib/admin/format"
import { PageHeader } from "@/components/admin/ui/page-header"
import { StatCard } from "@/components/admin/ui/stat-card"
import { ChartCard } from "@/components/admin/ui/chart-card"
import { BarChartMini, BRAND_CHART_PALETTE, type ChartDatum } from "@/components/admin/ui/charts"
import { PagosView } from "@/components/admin/pagos/pagos-view"

export const dynamic = "force-dynamic"

/**
 * Vista de finanzas: Pagos (D5). Server component: valida permiso (pagos:view),
 * arma el scope por rol y resuelve los pagos (sin filtros) + totales por estado.
 * Delega el filtrado en cliente y las acciones a PagosView. El flag puedeEditar
 * (pagos:edit) habilita alta, edición y acciones de estado.
 */
export default async function PagosPage() {
  const user = await requirePerm("pagos", "view")

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  const [data, flujo] = await Promise.all([
    getPagosData(scope, {}),
    getPagosFlujo(scope),
  ])
  const puedeEditar = can(user.rol, "pagos", "edit")
  const flujoVacio = flujo.every((f) => f.programado === 0 && f.pagado === 0)
  const flujoData: ChartDatum[] = flujo.map((f) => ({ ...f }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagos"
        description="Calendario programado vs pagado, CFDI y vencidos."
        icon={<Wallet className="size-6" aria-hidden />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Programado"
          value={formatMXN(data.totales.programado)}
          icon={CalendarClock}
          accent="brand"
        />
        <StatCard
          label="Pagado"
          value={formatMXN(data.totales.pagado)}
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          label="Vencido"
          value={
            <span className="text-red-600 dark:text-red-400">
              {formatMXN(data.totales.vencido)}
            </span>
          }
          icon={AlertTriangle}
          accent="neutral"
          sub="Programados con fecha vencida."
        />
      </div>

      <ChartCard
        title="Flujo de cobranza"
        description="Programado vs pagado por mes (últimos 6 meses)"
        height={260}
        isEmpty={flujoVacio}
        legend={[
          { label: "Programado", color: BRAND_CHART_PALETTE.gold },
          { label: "Pagado", color: BRAND_CHART_PALETTE.green },
        ]}
      >
        <BarChartMini
          data={flujoData}
          xKey="mes"
          bars={[
            { key: "programado", name: "Programado", color: BRAND_CHART_PALETTE.gold },
            { key: "pagado", name: "Pagado", color: BRAND_CHART_PALETTE.green },
          ]}
          valueFormat="mxn"
        />
      </ChartCard>

      <PagosView
        pagos={data.rows}
        totales={data.totales}
        puedeEditar={puedeEditar}
      />
    </div>
  )
}
