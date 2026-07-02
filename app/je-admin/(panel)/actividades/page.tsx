import { CalendarCheck } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getActividadesResumen,
  getUsuariosAsignables,
  type DashboardScope,
} from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { ActividadesView } from "@/components/admin/actividades/actividades-view"

export const dynamic = "force-dynamic"

/**
 * Agenda global de actividades. Server component: valida permiso
 * (actividades:view), arma el scope por rol y resuelve en paralelo el resumen
 * (chips) y los vendedores asignables. El listado paginado y las mutaciones se
 * gestionan del lado del cliente (ActividadesView) vía server actions.
 */
export default async function ActividadesPage() {
  return paginaTenant("actividades", async (user) => {
    const scope: DashboardScope = {
      rol: (user.rol ?? "lectura") as Rol,
      userId: user.id,
    }

    const [resumen, vendedores] = await Promise.all([
      getActividadesResumen(scope),
      getUsuariosAsignables(scope),
    ])

    const puedeEditar = can(scope.rol, "actividades", "edit")
    const puedeEliminar = scope.rol === "admin"

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Actividades"
          description="Agenda de tareas y seguimientos: vencimientos, prioridades y asignación por usuario."
          icon={<CalendarCheck className="size-6" aria-hidden />}
        />

        <ActividadesView
          resumen={resumen}
          vendedores={vendedores}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminar}
        />
      </div>
    )
  })
}
