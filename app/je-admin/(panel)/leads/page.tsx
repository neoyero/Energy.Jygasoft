import { Users } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getLeadsFiltrados,
  getLeadsResumen,
  getAsesoresAsignables,
  isScoped,
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
  const user = await requirePerm("leads", "view")

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  // Asignables a un lead = asesores activos vinculados a un usuario.
  const [leads, resumen, vendedores] = await Promise.all([
    getLeadsFiltrados(scope, {}),
    getLeadsResumen(scope),
    getAsesoresAsignables(),
  ])

  const puedeEditar = can(user.rol, "leads", "edit")
  const rolScoped = isScoped(scope.rol)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Prospectos captados por canal. Filtra, ordena y reasigna."
        icon={<Users className="size-6" aria-hidden />}
      />

      <LeadsView
        leadsIniciales={leads}
        resumen={resumen}
        vendedores={vendedores}
        puedeEditar={puedeEditar}
        rolScoped={rolScoped}
      />
    </div>
  )
}
