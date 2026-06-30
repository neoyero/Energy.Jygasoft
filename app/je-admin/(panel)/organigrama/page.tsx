import { Network } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { getOrganigrama } from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { Organigrama } from "@/components/admin/organizacion/organigrama"

export const dynamic = "force-dynamic"

/**
 * Organigrama (solo lectura) de la organización. Server component: valida
 * permiso (organizacion:view) y resuelve los nodos (usuarios activos con su
 * línea de reporte y área). El árbol se arma en el cliente.
 */
export default async function OrganigramaPage() {
  await requirePerm("organizacion", "view")
  const nodos = await getOrganigrama()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Organigrama"
        description="Estructura jerárquica del equipo. Edita jefe, cargo y área desde Usuarios."
        icon={<Network className="size-6" aria-hidden />}
      />
      <Organigrama nodos={nodos} />
    </div>
  )
}
