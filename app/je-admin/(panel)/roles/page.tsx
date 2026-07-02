import { ShieldCheck } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { fetchRoles } from "@/lib/admin/actions"
import { PageHeader } from "@/components/admin/ui/page-header"
import { RolesView } from "@/components/admin/roles/roles-view"

export const dynamic = "force-dynamic"

/**
 * Roles y permisos (RBAC dinámico, por empresa). Solo admin. Se listan/editan los
 * roles y su matriz de permisos por módulo. Nota: la APLICACIÓN de permisos aún
 * usa la matriz del código (Paso A); el enforcement dinámico es el Paso B.
 */
export default async function RolesPage() {
  return paginaTenant("roles", async (user) => {
    const puedeEditar = can(user.rol, "roles", "edit")
    const roles = await fetchRoles()

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Roles y permisos"
          description="Define roles y qué puede ver/editar cada uno por módulo. Los roles del sistema no se eliminan."
          icon={<ShieldCheck className="size-6" aria-hidden />}
        />
        <RolesView rolesIniciales={roles} puedeEditar={puedeEditar} />
      </div>
    )
  })
}
