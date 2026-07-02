import { Users } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can, type Rol } from "@/lib/admin/rbac"
import {
  getClientesFiltrados,
  getVendedores,
  acotarFiltroVendedor,
  type DashboardScope,
} from "@/lib/admin/queries"
import { PageHeader } from "@/components/admin/ui/page-header"
import { ClientesView } from "@/components/admin/clientes/clientes-view"

export const dynamic = "force-dynamic"

/**
 * Listado de Clientes (D4). Server component: valida permiso (clientes:view),
 * arma el scope por rol y resuelve en paralelo los clientes (sin filtros) y los
 * vendedores. Delega el filtrado en cliente y las vistas a ClientesView.
 */
export default async function ClientesPage() {
  return paginaTenant("clientes", async (user) => {
    const scope: DashboardScope = {
      rol: (user.rol ?? "lectura") as Rol,
      userId: user.id,
    }

    const [clientes, vendedoresAll] = await Promise.all([
      getClientesFiltrados(scope, {}),
      getVendedores(),
    ])

    const puedeEditar = can(user.rol, "clientes", "edit")
    const { vendedores, ocultarFiltro } = await acotarFiltroVendedor(scope, vendedoresAll)

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Clientes"
          description="Cartera de clientes. Filtra por tipo, vendedor o búsqueda."
          icon={<Users className="size-6" aria-hidden />}
        />

        <ClientesView
          clientesIniciales={clientes}
          vendedores={vendedores}
          puedeEditar={puedeEditar}
          rolScoped={ocultarFiltro}
        />
      </div>
    )
  })
}
