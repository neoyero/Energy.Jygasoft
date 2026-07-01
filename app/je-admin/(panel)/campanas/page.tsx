import { Megaphone } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { PageHeader } from "@/components/admin/ui/page-header"
import { CampanasView } from "@/components/admin/campanas/campanas-view"

export const dynamic = "force-dynamic"

/**
 * Campañas de marketing. Server component: valida permiso (campanas:view). El
 * listado paginado, la atribución de leads (CPL) y el CRUD se gestionan del lado
 * del cliente (CampanasView).
 */
export default async function CampanasPage() {
  const user = await requirePerm("campanas", "view")
  const puedeEditar = can(user.rol, "campanas", "edit")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campañas"
        description="Presupuesto, gasto y leads atribuidos por campaña (CPL). Filtra por estado o plataforma."
        icon={<Megaphone className="size-6" aria-hidden />}
      />
      <CampanasView puedeEditar={puedeEditar} />
    </div>
  )
}
