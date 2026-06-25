"use client"

import { useState } from "react"
import { Pencil, X } from "lucide-react"

import type { LeadRecord, VendedorOption } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/admin/ui/card"
import { LeadForm } from "@/components/admin/leads/lead-form"

export interface LeadEditPanelProps {
  lead: LeadRecord
  vendedores: ReadonlyArray<VendedorOption>
}

/**
 * Tarjeta del detalle que permite editar los datos del lead. Compacta por
 * defecto (título + botón); al activar muestra el LeadForm en modo edición.
 * Al guardar, el form refresca la ruta (RSC) y cierra el panel.
 */
export function LeadEditPanel({ lead, vendedores }: LeadEditPanelProps) {
  const [editando, setEditando] = useState(false)

  return (
    <Card>
      <CardHeader
        action={
          <Button
            type="button"
            size="sm"
            variant={editando ? "outline" : "default"}
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
                Editar datos
              </>
            )}
          </Button>
        }
      >
        <CardTitle>Datos del lead</CardTitle>
        <CardDescription>
          Completa o corrige la información de contacto, ubicación y consumo.
        </CardDescription>
      </CardHeader>

      {editando ? (
        <CardContent className="mt-4">
          <LeadForm
            modo="editar"
            lead={lead}
            vendedores={vendedores}
            onSuccess={() => setEditando(false)}
          />
        </CardContent>
      ) : null}
    </Card>
  )
}
