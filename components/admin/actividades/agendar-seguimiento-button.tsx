"use client"

import { useState } from "react"
import { CalendarPlus } from "lucide-react"

import type { VendedorOption } from "@/lib/admin/queries"
import { entidadTipo } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/admin/ui/modal"
import { ActividadForm } from "@/components/admin/actividades/actividad-form"

type EntidadTipo = (typeof entidadTipo.enumValues)[number]

export interface AgendarSeguimientoButtonProps {
  entidadTipo: EntidadTipo
  entidadId: string
  vendedores: ReadonlyArray<VendedorOption>
  /** Texto del botón (default "Agendar seguimiento"). */
  label?: string
  size?: "sm" | "default"
  variant?: "default" | "outline" | "ghost" | "secondary"
}

/**
 * Acceso rápido para crear una actividad ligada a una entidad concreta
 * (cotización, oportunidad, etc.) desde su propia pantalla. Abre el modal con el
 * ActividadForm en modo alta y la entidad fija; refresca al guardar.
 */
export function AgendarSeguimientoButton({
  entidadTipo: tipoEntidad,
  entidadId,
  vendedores,
  label = "Agendar seguimiento",
  size = "sm",
  variant = "outline",
}: AgendarSeguimientoButtonProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" aria-hidden /> {label}
      </Button>

      <Modal
        open={open}
        onOpenChange={(abierto) => {
          if (!abierto) setOpen(false)
        }}
        title="Agendar seguimiento"
        description="Crea una actividad ligada a este registro."
        size="2xl"
        dismissable={!saving}
      >
        <ActividadForm
          modo="crear"
          entidadFija={{ tipo: tipoEntidad, id: entidadId }}
          vendedores={vendedores}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          onSavingChange={setSaving}
        />
      </Modal>
    </>
  )
}
