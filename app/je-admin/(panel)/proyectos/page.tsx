import { FolderKanban } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { type Rol } from "@/lib/admin/rbac"
import {
  getProyectosFiltrados,
  getVendedores,
  isScoped,
  type DashboardScope,
} from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { ProyectosView } from "@/components/admin/proyectos/proyectos-view"

export const dynamic = "force-dynamic"

/**
 * Listado de Proyectos (D5). Server component: valida permiso (proyectos:view),
 * arma el scope por rol y resuelve en paralelo los proyectos (sin filtros) y los
 * vendedores. Delega el filtrado en cliente y las vistas a ProyectosView. No hay
 * alta de proyecto en D5: la edicion vive en el detalle.
 */
export default async function ProyectosPage() {
  const user = await requirePerm("proyectos", "view")

  const scope: DashboardScope = {
    rol: (user.rol ?? "lectura") as Rol,
    userId: user.id,
  }

  const [proyectos, vendedores] = await Promise.all([
    getProyectosFiltrados(scope, {}),
    getVendedores(),
  ])

  const rolScoped = isScoped(scope.rol)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proyectos"
        description="Cartera de proyectos. Filtra por fase, vendedor o búsqueda."
        icon={<FolderKanban className="size-6" aria-hidden />}
      />

      <ProyectosView
        proyectos={proyectos}
        vendedores={vendedores}
        rolScoped={rolScoped}
      />
    </div>
  )
}
