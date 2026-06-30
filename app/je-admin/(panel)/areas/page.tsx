import { Building2 } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getUsuarios } from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { AreasView } from "@/components/admin/areas/areas-view"

export const dynamic = "force-dynamic"

/**
 * Catálogo de Áreas/departamentos (organización). Server component: valida
 * permiso (areas:view) y resuelve los usuarios para el selector de líder. El
 * listado y el CRUD se gestionan del lado del cliente (AreasView).
 */
export default async function AreasPage() {
  const user = await requirePerm("areas", "view")
  const puedeEditar = can(user.rol, "areas", "edit")
  const usuarios = (await getUsuarios()).map((u) => ({ id: u.id, nombre: u.nombre }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Áreas"
        description="Departamentos de la organización. Define el líder de cada área."
        icon={<Building2 className="size-6" aria-hidden />}
      />
      <AreasView puedeEditar={puedeEditar} usuarios={usuarios} />
    </div>
  )
}
