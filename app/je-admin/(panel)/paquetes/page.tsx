import { PackagePlus } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { PageHeader } from "@/components/admin/ui/page-header"
import { PaquetesView } from "@/components/admin/paquetes/paquetes-view"

export const dynamic = "force-dynamic"

/**
 * Listado de Paquetes (bundles). Server component: valida permiso
 * (paquetes:view) y delega filtros/tabla/alta a PaquetesView. El listado se trae
 * del lado del cliente con paginación server-side.
 */
export default async function PaquetesPage() {
  const user = await requirePerm("paquetes", "view")
  const puedeEditar = can(user.rol, "paquetes", "edit")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paquetes"
        description="Bundles de productos y servicios para armar cotizaciones rápido."
        icon={<PackagePlus className="size-6" aria-hidden />}
      />
      <PaquetesView puedeEditar={puedeEditar} />
    </div>
  )
}
