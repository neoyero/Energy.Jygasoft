"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, X } from "lucide-react"

import { eliminarCliente } from "@/lib/admin/actions"
import type { ClienteDetalle, VendedorOption } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/admin/ui/confirm-button"
import { ClienteForm } from "@/components/admin/clientes/cliente-form"

export interface ClienteHeaderActionsProps {
  cliente: ClienteDetalle["cliente"]
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC clientes:edit -> habilita la edición. */
  puedeEditar: boolean
  /** Solo rol admin: habilita el borrado (lo decide la page). */
  puedeEliminar: boolean
}

/**
 * Acciones de cabecera del detalle de cliente: editar (toggle que despliega el
 * ClienteForm en modo "editar" en una sección plegable) y eliminar (ConfirmButton
 * destructivo que llama a eliminarCliente y, si tiene éxito, vuelve al listado).
 * Pensado para montarse en `actions` del PageHeader o justo debajo.
 */
export function ClienteHeaderActions({
  cliente,
  vendedores,
  puedeEditar,
  puedeEliminar,
}: ClienteHeaderActionsProps) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onEliminar(): void {
    setError(null)
    startTransition(async () => {
      const res = await eliminarCliente(cliente.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.push("/je-admin/clientes")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeEditar ? (
          <Button
            type="button"
            size="sm"
            variant={editando ? "outline" : "default"}
            disabled={pending}
            onClick={() => setEditando((prev) => !prev)}
          >
            {editando ? (
              <>
                <X className="size-4" aria-hidden />
                Cerrar
              </>
            ) : (
              <>
                <Pencil className="size-4" aria-hidden />
                Editar
              </>
            )}
          </Button>
        ) : null}

        {puedeEliminar ? (
          <ConfirmButton
            variant="destructive"
            size="sm"
            disabled={pending}
            destructive
            title="Eliminar cliente"
            description="Esta acción es permanente y no se puede deshacer. El cliente no podrá eliminarse si tiene proyectos, cotizaciones u oportunidades asociadas."
            confirmLabel="Eliminar"
            onConfirm={onEliminar}
          >
            <Trash2 className="size-4" aria-hidden />
            Eliminar
          </ConfirmButton>
        ) : null}

        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>

      {/* Form de edición (plegable) */}
      {puedeEditar && editando ? (
        <ClienteForm
          modo="editar"
          cliente={cliente}
          vendedores={vendedores}
          onSuccess={() => {
            setEditando(false)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
