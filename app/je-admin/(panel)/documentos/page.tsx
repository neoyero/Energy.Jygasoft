import { FolderOpen } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { PageHeader } from "@/components/admin/ui/page-header"
import { DocumentosView } from "@/components/admin/documentos/documentos-view"

export const dynamic = "force-dynamic"

/**
 * Listado global de Documentos (transversal a todas las entidades). Server
 * component: valida permiso (documentos:view). El listado paginado con scope por
 * subárbol, la subida a M365 y el borrado se gestionan del lado del cliente.
 */
export default async function DocumentosPage() {
  return paginaTenant("documentos", async (user) => {
    const puedeEditar = can(user.rol, "documentos", "edit")
    const puedeEliminar = puedeEditar

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Documentos"
          description="Archivos por entidad (contratos, recibos, unifilares, CFDI…). Filtra, busca, sube y abre."
          icon={<FolderOpen className="size-6" aria-hidden />}
        />
        <DocumentosView puedeEditar={puedeEditar} puedeEliminar={puedeEliminar} />
      </div>
    )
  })
}
