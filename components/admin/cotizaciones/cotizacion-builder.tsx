"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { AddItemControl } from "@/components/admin/cotizaciones/add-item-control";
import {
  ItemEditorRow,
  type ItemUI,
} from "@/components/admin/cotizaciones/item-editor-row";
import { TotalesPanel } from "@/components/admin/cotizaciones/totales-panel";
import { SistemaFields } from "@/components/admin/cotizaciones/sistema-fields";
import { EstadoActions } from "@/components/admin/cotizaciones/estado-actions";
import { calcularTotales, type Totales } from "@/lib/admin/cotizacion-calc";
import { actualizarCotizacionItems } from "@/lib/admin/actions";
import type {
  CatalogoOption,
  CotizacionDetalle,
} from "@/lib/admin/queries";

export interface CotizacionBuilderProps {
  detalle: CotizacionDetalle;
  catalogo: ReadonlyArray<CatalogoOption>;
  puedeEditar: boolean;
}

/** Genera un key efimero estable para una fila nueva (no persiste en BD). */
function nuevoKey(): string {
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Mapea las partidas persistidas a su forma editable en cliente. */
function toItemsUI(detalle: CotizacionDetalle): ItemUI[] {
  return detalle.items.map((row) => ({
    key: `db-${row.id}`,
    equipoId: row.equipoId,
    descripcion: row.descripcion,
    cantidad: row.cantidad,
    precioUnitario: row.precioUnitario,
  }));
}

/** Narrowing defensivo: ¿la respuesta de la action trae totales reconciliables? */
function esTotales(value: unknown): value is Totales {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.subtotal === "number" &&
    typeof t.iva === "number" &&
    typeof t.total === "number"
  );
}

/** Error seguro a partir de un valor desconocido. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "No se pudieron guardar las partidas. Intenta de nuevo.";
}

/**
 * Constructor/detalle de cotizacion (D4). Client component que orquesta:
 *  - Estado local de partidas (ItemUI[]) con totales calculados en vivo.
 *  - Alta de partidas (catalogo o manual) y edicion/borrado fila a fila.
 *  - Guardado via Server Action en useTransition; reconcilia los totales
 *    devueltos por el servidor (si los devuelve) y refresca la ruta.
 *  - Especificaciones del sistema (solo lectura) y acciones de estado.
 * Si !puedeEditar, todo es solo lectura (sin AddItem, sin guardar, filas
 * bloqueadas, sin acciones de estado).
 */
export function CotizacionBuilder({
  detalle,
  catalogo,
  puedeEditar,
}: CotizacionBuilderProps) {
  const router = useRouter();
  const { cotizacion } = detalle;

  const [items, setItems] = useState<ItemUI[]>(() => toItemsUI(detalle));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  // Totales reconciliados desde el servidor tras guardar (prevalecen sobre el
  // calculo local hasta que el usuario vuelva a editar).
  const [totalesServidor, setTotalesServidor] = useState<Totales | null>(null);

  const totalesLocales = useMemo(
    () =>
      calcularTotales(
        items.map((i) => ({
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
      ),
    [items],
  );

  const totales = totalesServidor ?? totalesLocales;

  function handleAdd(nuevo: Omit<ItemUI, "key">) {
    setOkMsg(null);
    setTotalesServidor(null);
    setItems((prev) => [...prev, { ...nuevo, key: nuevoKey() }]);
  }

  function handleChange(key: string, next: ItemUI) {
    setOkMsg(null);
    setTotalesServidor(null);
    setItems((prev) => prev.map((i) => (i.key === key ? next : i)));
  }

  function handleRemove(key: string) {
    setOkMsg(null);
    setTotalesServidor(null);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function handleGuardar() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        const payload = items.map((i) => ({
          equipoId: i.equipoId,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        }));
        const result = await actualizarCotizacionItems(cotizacion.id, payload);
        if (esTotales(result)) {
          setTotalesServidor(result);
        }
        setOkMsg("Partidas guardadas.");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Columna principal: partidas */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            action={
              puedeEditar ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={handleGuardar}
                >
                  <Save aria-hidden />
                  {pending ? "Guardando…" : "Guardar partidas"}
                </Button>
              ) : null
            }
          >
            <CardTitle>Partidas</CardTitle>
            <CardDescription>
              {puedeEditar
                ? "Agrega equipos del catalogo o partidas manuales. Los totales se recalculan en vivo."
                : "Detalle de partidas (solo lectura)."}
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-4 space-y-3">
            {puedeEditar ? (
              <AddItemControl
                catalogo={catalogo}
                onAdd={handleAdd}
                disabled={pending}
              />
            ) : null}

            {items.length === 0 ? (
              <EmptyState
                title="Sin partidas"
                description={
                  puedeEditar
                    ? "Agrega la primera partida desde el catalogo o como partida manual."
                    : "Esta cotizacion aun no tiene partidas."
                }
                size="sm"
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <ItemEditorRow
                    key={item.key}
                    item={item}
                    readOnly={!puedeEditar || pending}
                    onChange={(next) => handleChange(item.key, next)}
                    onRemove={() => handleRemove(item.key)}
                  />
                ))}
              </div>
            )}

            {error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
            {okMsg ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {okMsg}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Especificaciones del sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Sistema</CardTitle>
            <CardDescription>
              Dimensionamiento y metricas energeticas (solo lectura).
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <SistemaFields
              capacidadKwp={cotizacion.capacidadKwp}
              paneles={cotizacion.paneles}
              inversor={cotizacion.inversor}
              produccionAnualKwh={cotizacion.produccionAnualKwh}
              ahorroAnualMxn={cotizacion.ahorroAnualMxn}
              paybackAnios={cotizacion.paybackAnios}
              esquema={cotizacion.esquema}
            />
          </CardContent>
        </Card>
      </div>

      {/* Columna lateral: totales + acciones de estado */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="mt-4">
            <TotalesPanel
              subtotal={totales.subtotal}
              iva={totales.iva}
              total={totales.total}
              moneda={cotizacion.moneda}
            />
          </CardContent>
        </Card>

        {puedeEditar ? (
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
              <CardDescription>
                Transiciones de estado y versionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4">
              <EstadoActions
                cotizacionId={cotizacion.id}
                estado={cotizacion.estado}
                puedeEditar={puedeEditar}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
