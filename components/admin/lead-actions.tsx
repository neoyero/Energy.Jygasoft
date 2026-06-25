"use client";

import { useState, useTransition } from "react";

import { updateLeadEstado, convertLead, asignarLead } from "@/lib/admin/actions";
import { ConfirmButton } from "@/components/admin/ui/confirm-button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { labelFor } from "@/components/admin/ui/status-badge";
import type { VendedorOption } from "@/lib/admin/queries";
import { leadEstado } from "@/db/schema";
import { cn } from "@/lib/utils";

type LeadEstado = (typeof leadEstado.enumValues)[number];

/** Cambio pendiente de confirmación disparado desde un select. */
type CambioPendiente =
  | { tipo: "estado"; valor: LeadEstado; etiqueta: string }
  | { tipo: "vendedor"; valor: string | null; etiqueta: string }
  | null;

const ESTADOS = leadEstado.enumValues;

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
  const [cambio, setCambio] = useState<CambioPendiente>(null);
  const convertido = estado === "convertido";

  // Intercepta el cambio de un select: revierte el valor visual (el select es
  // controlado) y abre el modal de confirmación con el cambio propuesto.
  function pedirCambioEstado(e: React.ChangeEvent<HTMLSelectElement>): void {
    const valor = e.target.value as LeadEstado;
    e.currentTarget.value = estado;
    if (valor === estado) return;
    setCambio({ tipo: "estado", valor, etiqueta: labelFor(valor) });
  }

  function pedirCambioVendedor(e: React.ChangeEvent<HTMLSelectElement>): void {
    const raw = e.target.value;
    e.currentTarget.value = vendedorId ?? "";
    const valor = raw === "" ? null : raw;
    if (valor === (vendedorId ?? null)) return;
    const etiqueta =
      valor === null
        ? "Sin asignar"
        : (vendedores.find((v) => v.id === valor)?.nombre ?? "el vendedor");
    setCambio({ tipo: "vendedor", valor, etiqueta });
  }

  // Ejecuta el cambio pendiente tras confirmar en el modal.
  function confirmarCambio(): void {
    const ch = cambio;
    setCambio(null);
    if (!ch) return;
    if (ch.tipo === "estado") {
      run(() => updateLeadEstado(leadId, ch.valor));
    } else {
      run(() => asignarLead(leadId, ch.valor));
    }
  }

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
            onChange={pedirCambioEstado}
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
            onChange={pedirCambioVendedor}
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
        <ConfirmButton
          size="sm"
          disabled={pending || convertido}
          title="Convertir lead"
          description="Se creará un cliente y una oportunidad a partir de este lead, y el lead quedará marcado como «convertido». Esta acción no se puede deshacer. ¿Continuar?"
          confirmLabel="Convertir"
          onConfirm={() => run(() => convertLead(leadId))}
        >
          {convertido ? "Convertido" : "Convertir a cliente + oportunidad"}
        </ConfirmButton>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {/* Confirmación de cambios disparados por los selects. */}
      <ConfirmDialog
        open={cambio !== null}
        onOpenChange={(open) => {
          if (!open) setCambio(null);
        }}
        title={cambio?.tipo === "estado" ? "Cambiar estado" : "Cambiar asignación"}
        description={
          cambio?.tipo === "estado" ? (
            <>
              El estado del lead cambiará a{" "}
              <strong>{cambio.etiqueta}</strong>. ¿Continuar?
            </>
          ) : cambio?.tipo === "vendedor" ? (
            <>
              El lead se asignará a <strong>{cambio.etiqueta}</strong>.
              ¿Continuar?
            </>
          ) : null
        }
        confirmLabel="Confirmar"
        onConfirm={confirmarCambio}
      />
    </div>
  );
}
