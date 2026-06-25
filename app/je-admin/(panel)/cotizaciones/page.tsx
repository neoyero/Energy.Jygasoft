import { FileText } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getCotizacionesFiltradas,
  getVendedores,
  isScoped,
  type DashboardScope,
} from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { CotizacionesView } from "@/components/admin/cotizaciones/cotizaciones-view"

export const dynamic = "force-dynamic"

/**
 * Listado de Cotizaciones (D4). Server component: valida permiso
 * (cotizaciones:view), arma el scope por rol y resuelve en paralelo las
 * cotizaciones y los vendedores. Delega el filtrado y la vista a
 * CotizacionesView.
 */
export default async function CotizacionesPage() {
  const user = await requirePerm("cotizaciones", "view")

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  const [cotizaciones, vendedores] = await Promise.all([
    getCotizacionesFiltradas(scope, {}),
    getVendedores(),
  ])

  const puedeEditar = can(user.rol, "cotizaciones", "edit")
  const rolScoped = isScoped(scope.rol)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cotizaciones"
        description="Cotizaciones versionadas por cliente. Filtra por estado, vendedor o folio."
        icon={<FileText className="size-6" aria-hidden />}
      />

      <CotizacionesView
        cotizacionesIniciales={cotizaciones}
        vendedores={vendedores}
        puedeEditar={puedeEditar}
        rolScoped={rolScoped}
      />
    </div>
  )
}
