import { Users } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getLeadsResumen,
  getAsesoresAsignables,
  acotarFiltroVendedor,
  type DashboardScope,
} from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { LeadsView } from "@/components/admin/leads/leads-view"

export const dynamic = "force-dynamic"

/**
 * Listado de Leads (D3). Server component: valida permiso (leads:view), arma el
 * scope por rol y resuelve en paralelo los leads, el resumen por estado y los
 * vendedores. Delega el filtrado y las vistas (tabla/kanban) a LeadsView.
 */
export default async function LeadsPage() {
  return paginaTenant("leads", async (user) => {
    const scope: DashboardScope = {
      rol: (user.rol ?? "lectura") as Rol,
      userId: user.id,
    }

    // Resumen por estado (chips) + asesores asignables. Los leads se traen del
    // lado del cliente con paginación/scroll infinito (server actions).
    const [resumen, vendedoresAll] = await Promise.all([
      getLeadsResumen(scope),
      getAsesoresAsignables(),
    ])

    const puedeEditar = can(user.rol, "leads", "edit")
    // Visibilidad por subárbol: el filtro de vendedor se acota al equipo del rol.
    const { vendedores, ocultarFiltro } = await acotarFiltroVendedor(scope, vendedoresAll)

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Leads"
          description="Prospectos captados por canal. Filtra, ordena y reasigna."
          icon={<Users className="size-6" aria-hidden />}
        />

        <LeadsView
          resumen={resumen}
          vendedores={vendedores}
          puedeEditar={puedeEditar}
          rolScoped={ocultarFiltro}
        />
      </div>
    )
  })
}
