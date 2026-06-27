import { Package } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getProductoTipos } from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { ProductosView } from "@/components/admin/productos/productos-view"

export const dynamic = "force-dynamic"

/**
 * Catálogo unificado de Productos. Server component: valida permiso
 * (productos:view) y resuelve los tipos (con conteo de productos). El listado de
 * productos se trae del lado del cliente con paginación server-side. Delega las
 * vistas (productos / tipos) a ProductosView.
 */
export default async function ProductosPage() {
  const user = await requirePerm("productos", "view")
  const tipos = await getProductoTipos()
  const puedeEditar = can(user.rol, "productos", "edit")
  const puedeEliminar = user.rol === "admin"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos"
        description="Catálogo de productos por tipo. Filtra, busca y administra precios y atributos."
        icon={<Package className="size-6" aria-hidden />}
      />

      <ProductosView
        tipos={tipos}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
      />
    </div>
  )
}
