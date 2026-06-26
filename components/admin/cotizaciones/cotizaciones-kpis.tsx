import { FileText, CheckCircle2, Send, FileEdit } from "lucide-react"

import type { CotizacionesKpis as CotizacionesKpisData } from "@/lib/admin/queries"
import { formatInt, formatMXN } from "@/lib/admin/format"
import { StatCard } from "@/components/admin/ui/stat-card"

export interface CotizacionesKpisProps {
  kpis: CotizacionesKpisData
}

/**
 * Fila de KPIs del listado de Cotizaciones. Componente presentacional sin
 * estado (server-friendly): resume el total, el monto aceptado/enviado y el
 * conteo de borradores en una grilla de StatCard coherente con el resto del
 * panel.
 */
export function CotizacionesKpis({ kpis }: CotizacionesKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        label="Total"
        value={formatInt(kpis.total)}
        icon={FileText}
        accent="brand"
      />
      <StatCard
        label="Aceptado"
        value={formatMXN(kpis.montoAceptado)}
        icon={CheckCircle2}
        accent="green"
      />
      <StatCard
        label="Enviadas"
        value={formatMXN(kpis.montoEnviadas)}
        icon={Send}
        accent="gold"
      />
      <StatCard
        label="Borradores"
        value={formatInt(kpis.porEstado.borrador)}
        icon={FileEdit}
        accent="neutral"
      />
    </div>
  )
}
