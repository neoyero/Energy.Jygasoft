"use client";

import { useState, useTransition } from "react";

import { updateLeadEstado, convertLead, asignarLead } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { labelFor } from "@/components/admin/ui/status-badge";
import type { VendedorOption } from "@/lib/admin/queries";
import { schema } from "@/db";
import { cn } from "@/lib/utils";

type LeadEstado = (typeof schema.leadEstado.enumValues)[number];

const ESTADOS = schema.leadEstado.enumValues;

export interface LeadActionsProps {
  leadId: string;
  estado: string;
  vendedorId: string | null;
  vendedores: ReadonlyArray<VendedorOption>;
}

const selectClasses = cn(
  "h-8 rounded-lg border border-border bg-background px-2.5 text-sm",
  "text-foreground transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50",
);

const fieldLabelClasses = "text-xs font-medium text-muted-foreground";

/**
 * Controles de gestion del lead (solo visibles para roles con permiso de
 * edicion). Tres acciones independientes resueltas por Server Action y
 * envueltas en useTransition: cambio de estado, asignacion de vendedor y
 * conversion a cliente + oportunidad. Errores se muestran inline.
 */
export function LeadActions({
  leadId,
  estado,
  vendedorId,
  vendedores,
}: LeadActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const convertido = estado === "convertido";

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return "No se pudo completar la accion. Intenta de nuevo.";
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Estado */}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Estado</span>
          <select
            value={estado}
            disabled={pending}
            onChange={(e) =>
              run(() => updateLeadEstado(leadId, e.target.value as LeadEstado))
            }
            className={selectClasses}
          >
            {ESTADOS.map((value) => (
              <option key={value} value={value}>
                {labelFor(value)}
              </option>
            ))}
          </select>
        </label>

        {/* Vendedor asignado */}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Vendedor</span>
          <select
            value={vendedorId ?? ""}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.value;
              run(() => asignarLead(leadId, value === "" ? null : value));
            }}
            className={selectClasses}
          >
            <option value="">Sin asignar</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* Convertir */}
        <Button
          size="sm"
          disabled={pending || convertido}
          onClick={() => run(() => convertLead(leadId))}
        >
          {convertido ? "Convertido" : "Convertir a cliente + oportunidad"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
