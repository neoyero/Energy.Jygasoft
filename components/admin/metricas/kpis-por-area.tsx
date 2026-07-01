import { Building2 } from "lucide-react"

import type { AreaKpiRow } from "@/lib/admin/queries"
import { formatMXN, formatInt } from "@/lib/admin/format"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"

export interface KpisPorAreaProps {
  rows: ReadonlyArray<AreaKpiRow>
}

/**
 * Tabla de KPIs comerciales agregados por área (Fase 4). Server component puro.
 * Cada fila es un área activa con sus miembros y totales (leads, oportunidades
 * abiertas + forecast ponderado, clientes, proyectos), ya acotados por scope.
 */
export function KpisPorArea({ rows }: KpisPorAreaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-5" aria-hidden /> KPIs por área
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            title="Sin áreas"
            description="Crea áreas y asígnalas a tu equipo para ver los KPIs por departamento."
            size="sm"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 text-right font-medium">Miembros</th>
                  <th className="px-3 py-2 text-right font-medium">Leads</th>
                  <th className="px-3 py-2 text-right font-medium">Oport. abiertas</th>
                  <th className="px-3 py-2 text-right font-medium">Forecast</th>
                  <th className="px-3 py-2 text-right font-medium">Clientes</th>
                  <th className="px-3 py-2 text-right font-medium">Proyectos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{r.nombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatInt(r.miembros)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatInt(r.leads)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatInt(r.oportunidadesAbiertas)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-brand-green-dark dark:text-brand-green">
                      {formatMXN(r.montoPonderado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatInt(r.clientes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatInt(r.proyectos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
