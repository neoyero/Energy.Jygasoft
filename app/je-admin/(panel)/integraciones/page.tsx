import { KeyRound } from "lucide-react"

import { requirePerm } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { getIntegracionesAdmin } from "@/lib/config/service"
import { PageHeader } from "@/components/admin/ui/page-header"
import { IntegracionesView } from "@/components/admin/integraciones/integraciones-view"

export const dynamic = "force-dynamic"

/**
 * Integraciones: administración de conexiones externas (Chatwoot, M365, Meta,
 * n8n, Gemini, Turnstile) con sus tokens/keys cifrados en BD. Solo admin. Los
 * secretos nunca se muestran (write-only); la vista solo indica si están
 * configurados y de qué fuente (BD/env).
 */
export default async function IntegracionesPage() {
  const user = await requirePerm("integraciones", "view")
  const puedeEditar = can(user.rol, "integraciones", "edit")
  const integraciones = await getIntegracionesAdmin()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integraciones"
        description="Conexiones externas y sus credenciales (cifradas en BD). Los secretos no se muestran: escribe uno nuevo para reemplazarlo."
        icon={<KeyRound className="size-6" aria-hidden />}
      />
      <IntegracionesView integraciones={integraciones} puedeEditar={puedeEditar} />
    </div>
  )
}
