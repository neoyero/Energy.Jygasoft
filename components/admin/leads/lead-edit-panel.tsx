"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"

import type { LeadRecord, VendedorOption } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/admin/ui/card"
import { Modal } from "@/components/admin/ui/modal"
import { LeadForm } from "@/components/admin/leads/lead-form"

export interface LeadEditPanelProps {
  lead: LeadRecord
  vendedores: ReadonlyArray<VendedorOption>
}

/**
 * Tarjeta del detalle que permite editar los datos del lead. El botón "Editar
 * datos" abre el LeadForm en un modal (responsive). Al guardar, el form refresca
 * la ruta (RSC) y cierra el modal.
 */
export function LeadEditPanel({ lead, vendedores }: LeadEditPanelProps) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <>
      <Card>
        <CardHeader
          action={
            <Button type="button" size="sm" onClick={() => setEditando(true)}>
              <Pencil className="size-4" aria-hidden />
              Editar datos
            </Button>
          }
        >
          <CardTitle>Datos del lead</CardTitle>
          <CardDescription>
            Completa o corrige la información de contacto, ubicación y consumo.
          </CardDescription>
        </CardHeader>
      </Card>

      <Modal
        open={editando}
        onOpenChange={(abierto) => {
          if (!abierto) setEditando(false)
        }}
        title="Editar lead"
        description="Actualiza la información de contacto, ubicación y consumo."
        size="3xl"
        dismissable={!saving}
      >
        <LeadForm
          modo="editar"
          lead={lead}
          vendedores={vendedores}
          onSuccess={() => setEditando(false)}
          onCancel={() => setEditando(false)}
          onSavingChange={setSaving}
        />
      </Modal>
    </>
  )
}
