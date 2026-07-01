import { Network } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getOrganigrama, getAreasArbol } from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { Organigrama } from "@/components/admin/organizacion/organigrama"

export const dynamic = "force-dynamic"

/**
 * Organigrama de la organización. Server component: valida permiso
 * (organizacion:view) y resuelve los nodos (usuarios activos con su línea de
 * reporte y área). El árbol se arma en el cliente; con organizacion:edit se
 * puede reasignar el jefe arrastrando tarjetas.
 */
export default async function OrganigramaPage() {
  const user = await requirePerm("organizacion", "view")
  const [nodos, areasArbol] = await Promise.all([getOrganigrama(), getAreasArbol()])
  const areas = areasArbol
    .filter((a) => a.activa)
    .map((a) => ({ id: a.id, nombre: a.nombre, padreId: a.padreId }))
  const puedeEditar = can(user.rol, "organizacion", "edit")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Organigrama"
        description="Estructura jerárquica del equipo. Arrastra una tarjeta sobre otra para reasignar su jefe."
        icon={<Network className="size-6" aria-hidden />}
      />
      <Organigrama nodos={nodos} areas={areas} puedeEditar={puedeEditar} />
    </div>
  )
}
