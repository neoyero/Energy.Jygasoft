"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Copy } from "lucide-react";

import { ConfirmButton } from "@/components/admin/ui/confirm-button";
import {
  cambiarEstadoCotizacion,
  nuevaVersionCotizacion,
} from "@/lib/admin/actions";
import type { CotizacionEstado } from "@/lib/admin/queries";

export interface EstadoActionsProps {
  cotizacionId: string;
  estado: CotizacionEstado;
  /** Si es false, no se renderiza ninguna accion (solo lectura). */
  puedeEditar?: boolean;
}

/** Mensaje de error seguro a partir de un error desconocido. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "No se pudo completar la accion. Intenta de nuevo.";
}

/**
 * Acciones de cambio de estado de la cotizacion segun las transiciones
 * validas:
 *  - borrador -> Enviar.
 *  - enviada  -> Aceptar / Rechazar.
 * "Nueva version" esta siempre disponible (clona la cotizacion en borrador).
 * Cada accion corre en useTransition; tras exito se refresca la ruta (RSC)
 * para reflejar el nuevo estado. Errores inline.
 */
export function EstadoActions({
  cotizacionId,
  estado,
  puedeEditar = true,
}: EstadoActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!puedeEditar) return null;

  function run(action: () => Promise<{ ok: boolean; error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res && res.ok === false) {
          setError(res.error ?? "No se pudo completar la acción.");
          return;
        }
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    });
  }

  const esBorrador = estado === "borrador";
  const esEnviada = estado === "enviada";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {esBorrador ? (
          <ConfirmButton
            size="sm"
            disabled={pending}
            title="Enviar cotización"
            description="La cotización pasará a estado «enviada» y quedará lista para la respuesta del cliente. ¿Continuar?"
            confirmLabel="Enviar"
            onConfirm={() =>
              run(() => cambiarEstadoCotizacion(cotizacionId, "enviada"))
            }
          >
            <Send aria-hidden />
            Enviar
          </ConfirmButton>
        ) : null}

        {esEnviada ? (
          <>
            <ConfirmButton
              size="sm"
              title="Aceptar cotización"
              description="Se marcará la cotización como «aceptada». ¿Continuar?"
              confirmLabel="Aceptar"
              disabled={pending}
              onConfirm={() =>
                run(() => cambiarEstadoCotizacion(cotizacionId, "aceptada"))
              }
            >
              <Check aria-hidden />
              Aceptar
            </ConfirmButton>
            <ConfirmButton
              size="sm"
              variant="destructive"
              title="Rechazar cotización"
              description="Se marcará la cotización como «rechazada». ¿Continuar?"
              confirmLabel="Rechazar"
              disabled={pending}
              onConfirm={() =>
                run(() => cambiarEstadoCotizacion(cotizacionId, "rechazada"))
              }
            >
              <X aria-hidden />
              Rechazar
            </ConfirmButton>
          </>
        ) : null}

        <ConfirmButton
          size="sm"
          variant="outline"
          title="Nueva versión"
          description="Se creará una nueva versión en borrador clonando esta cotización. ¿Continuar?"
          confirmLabel="Crear versión"
          disabled={pending}
          onConfirm={() => run(() => nuevaVersionCotizacion(cotizacionId))}
        >
          <Copy aria-hidden />
          Nueva version
        </ConfirmButton>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
