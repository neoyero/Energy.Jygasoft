import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { paginaTenant } from "@/lib/admin/guard"
import { can } from "@/lib/admin/rbac"
import { chatwootConfigurado } from "@/lib/chatwoot/client"
import { PageHeader } from "@/components/admin/ui/page-header"
import { ChatwootAdmin } from "@/components/admin/chatwoot/chatwoot-admin"

export const dynamic = "force-dynamic"

/**
 * Administración de la instancia de Chatwoot (agentes, inboxes, equipos,
 * respuestas, etiquetas, atributos, webhooks) vía la Application API. El token
 * vive cifrado en la BD (integraciones) y nunca sale del backend: la UI llama a
 * server actions protegidas por sesión/rol.
 */
export default async function ChatwootPage() {
  return paginaTenant("chatwoot", async (user) => {
    const puedeEditar = can(user.rol, "chatwoot", "edit")
    const configurado = await chatwootConfigurado()

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Chatwoot"
          description="Administra tu instancia de Chatwoot desde aquí: agentes, inboxes, equipos, respuestas, etiquetas, atributos y webhooks."
          icon={<MessagesSquare className="size-6" aria-hidden />}
        />

        {configurado ? (
          <ChatwootAdmin puedeEditar={puedeEditar} />
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Chatwoot aún no está configurado. Ve a{" "}
            <Link href="/je-admin/integraciones" className="font-medium underline">
              Integraciones
            </Link>{" "}
            y captura la URL, el Account ID y el API token de Chatwoot.
          </div>
        )}
      </div>
    )
  })
}
