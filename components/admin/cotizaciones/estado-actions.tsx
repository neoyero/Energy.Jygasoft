"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
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
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => cambiarEstadoCotizacion(cotizacionId, "enviada"))
            }
          >
            <Send aria-hidden />
            Enviar
          </Button>
        ) : null}

        {esEnviada ? (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => cambiarEstadoCotizacion(cotizacionId, "aceptada"))
              }
            >
              <Check aria-hidden />
              Aceptar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() => cambiarEstadoCotizacion(cotizacionId, "rechazada"))
              }
            >
              <X aria-hidden />
              Rechazar
            </Button>
          </>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => nuevaVersionCotizacion(cotizacionId))}
        >
          <Copy aria-hidden />
          Nueva version
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
