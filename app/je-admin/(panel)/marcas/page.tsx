import { Tag } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { PageHeader } from "@/components/admin/ui/page-header"
import { MarcasView } from "@/components/admin/marcas/marcas-view"

export const dynamic = "force-dynamic"

/** Catálogo de Marcas (grupo "Catálogos"). */
export default async function MarcasPage() {
  const user = await requirePerm("marcas", "view")
  const puedeEditar = can(user.rol, "marcas", "edit")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marcas"
        description="Catálogo de marcas para los productos."
        icon={<Tag className="size-6" aria-hidden />}
      />
      <MarcasView puedeEditar={puedeEditar} />
    </div>
  )
}
