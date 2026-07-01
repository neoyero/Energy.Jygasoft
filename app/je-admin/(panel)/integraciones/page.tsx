import { KeyRound } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getIntegracionesAdmin } from "@/lib/config/service"
import { PageHeader } from "@/components/admin/ui/page-header"
import { IntegracionesView } from "@/components/admin/integraciones/integraciones-view"

export const dynamic = "force-dynamic"

/**
 * Integraciones: administración de conexiones externas (Chatwoot, M365, Meta,
 * n8n, Gemini, Turnstile + personalizadas) con sus tokens/keys cifrados en BD.
 * Solo admin. Los secretos se guardan cifrados y se muestran enmascarados; se
 * pueden revelar bajo demanda (acción explícita) para verificarlos/copiarlos.
 */
export default async function IntegracionesPage() {
  const user = await requirePerm("integraciones", "view")
  const puedeEditar = can(user.rol, "integraciones", "edit")
  const integraciones = await getIntegracionesAdmin()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integraciones"
        description="Conexiones externas y sus credenciales (cifradas en BD). Los campos sensibles van enmascarados; puedes revelarlos o crear una integración nueva."
        icon={<KeyRound className="size-6" aria-hidden />}
      />
      <IntegracionesView integraciones={integraciones} puedeEditar={puedeEditar} />
    </div>
  )
}
