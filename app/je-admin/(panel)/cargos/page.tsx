import { IdCard } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { PageHeader } from "@/components/admin/ui/page-header"
import { CargosView } from "@/components/admin/cargos/cargos-view"

export const dynamic = "force-dynamic"

/**
 * Catálogo de Cargos (Director, Subdirector, Gerente…). Se asigna a cada usuario
 * y sirve como "rol" de los líderes de área. Server component: valida permiso.
 */
export default async function CargosPage() {
  return paginaTenant("cargos", async (user) => {
    const puedeEditar = can(user.rol, "cargos", "edit")

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Cargos"
          description="Catálogo de cargos de la organización. Se asignan a los usuarios y a los líderes de cada área."
          icon={<IdCard className="size-6" aria-hidden />}
        />
        <CargosView puedeEditar={puedeEditar} />
      </div>
    )
  })
}
