"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Copy, Mail, Clock, FolderPlus, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/ui/confirm-button";
import { ProgramarPagoForm } from "@/components/admin/cotizaciones/programar-pago-form";
import {
  cambiarEstadoCotizacion,
  nuevaVersionCotizacion,
  enviarCotizacionPorCorreo,
  crearProyectoDeCotizacion,
} from "@/lib/admin/actions";
import type { CotizacionEstado } from "@/lib/admin/queries";

export interface EstadoActionsProps {
  cotizacionId: string;
  estado: CotizacionEstado;
  /** Si es false, no se renderiza ninguna accion (solo lectura). */
  puedeEditar?: boolean;
  /**
   * Si es false, bloquea el envio (Enviar / Enviar por correo) hasta que la
   * cotizacion este completa. Default true para no romper otros usos.
   */
  lista?: boolean;
  /** Motivos por los que aun no esta lista para enviarse (se muestran como aviso). */
  faltantes?: string[];
}

/** Mensaje de error seguro a partir de un error desconocido. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "No se pudo completar la accion. Intenta de nuevo.";
}

/**
 * Acciones de cambio de estado de la cotizacion segun las transiciones
 * validas:
 *  - borrador          -> Enviar / Enviar por correo.
 *  - enviada           -> Aceptar / Rechazar / Enviar por correo / Marcar expirada.
 *  - aceptada          -> Generar proyecto / Programar pago.
 * "Nueva version" esta siempre disponible (clona la cotizacion en borrador).
 * Cada accion corre en useTransition; tras exito se refresca la ruta (RSC)
 * para reflejar el nuevo estado. Errores inline; avisos no-error (ej. correo
 * no configurado) se muestran aparte.
 */
export function EstadoActions({
  cotizacionId,
  estado,
  puedeEditar = true,
  lista = true,
  faltantes = [],
}: EstadoActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarPago, setMostrarPago] = useState(false);

  if (!puedeEditar) return null;

  function run(
    action: () => Promise<
      { ok: boolean; error?: string; skipped?: boolean; id?: string } | void
    >,
    onOk?: (res: { ok: boolean; skipped?: boolean; id?: string }) => void,
  ) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res && res.ok === false) {
          setError(res.error ?? "No se pudo completar la acción.");
          return;
        }
        if (res && res.skipped) {
          setAviso("Correo no configurado; no se envió.");
        }
        if (res) onOk?.(res);
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    });
  }

  const esBorrador = estado === "borrador";
  const esEnviada = estado === "enviada";
  const esAceptada = estado === "aceptada";

  // El envio (Enviar / Enviar por correo) se bloquea hasta que la cotizacion
  // este lista. El resto de acciones no dependen de `lista`.
  const envioBloqueado = !lista;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {esBorrador ? (
          <ConfirmButton
            size="sm"
            disabled={pending || envioBloqueado}
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

        {esBorrador || esEnviada ? (
          <ConfirmButton
            size="sm"
            variant="outline"
            title="Enviar por correo"
            description="Se generará el PDF y se enviará la cotización al correo del cliente. ¿Continuar?"
            confirmLabel="Enviar"
            disabled={pending || envioBloqueado}
            onConfirm={() =>
              run(() => enviarCotizacionPorCorreo(cotizacionId))
            }
          >
            <Mail aria-hidden />
            Enviar por correo
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
            <ConfirmButton
              size="sm"
              variant="destructive"
              title="Marcar expirada"
              description="Se marcará la cotización como «expirada». ¿Continuar?"
              confirmLabel="Marcar expirada"
              disabled={pending}
              onConfirm={() =>
                run(() => cambiarEstadoCotizacion(cotizacionId, "expirada"))
              }
            >
              <Clock aria-hidden />
              Marcar expirada
            </ConfirmButton>
          </>
        ) : null}

        {esAceptada ? (
          <>
            <ConfirmButton
              size="sm"
              title="Generar proyecto"
              description="Se creará un proyecto a partir de esta cotización aceptada. ¿Continuar?"
              confirmLabel="Generar proyecto"
              disabled={pending}
              onConfirm={() =>
                run(
                  () => crearProyectoDeCotizacion(cotizacionId),
                  (res) => {
                    if (res.ok && res.id) {
                      router.push(`/je-admin/proyectos/${res.id}`);
                    }
                  },
                )
              }
            >
              <FolderPlus aria-hidden />
              Generar proyecto
            </ConfirmButton>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setMostrarPago((v) => !v)}
              aria-expanded={mostrarPago}
            >
              <Banknote aria-hidden />
              Programar pago
            </Button>
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

      {envioBloqueado && faltantes.length > 0 ? (
        <p role="status" className="text-xs font-medium text-muted-foreground">
          Para enviar: {faltantes.join(" · ")}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {aviso ? (
        <p role="status" className="text-xs font-medium text-muted-foreground">
          {aviso}
        </p>
      ) : null}

      {esAceptada && mostrarPago ? (
        <ProgramarPagoForm
          cotizacionId={cotizacionId}
          onSuccess={() => setMostrarPago(false)}
        />
      ) : null}
    </div>
  );
}
