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
import { SistemaForm } from "@/components/admin/cotizaciones/sistema-form";
import { SistemaWizardStep } from "@/components/admin/cotizaciones/sistema-wizard-step";
import { CotizacionPaquetePanel } from "@/components/admin/cotizaciones/cotizacion-paquete-panel";
import { RelacionesCard } from "@/components/admin/cotizaciones/relaciones-card";
import { CotizacionDocumentosPanel } from "@/components/admin/cotizaciones/cotizacion-documentos-panel";
import { CotizacionHistorial } from "@/components/admin/cotizaciones/cotizacion-historial";
import { EstadoActions } from "@/components/admin/cotizaciones/estado-actions";
import { calcularTotales, type Totales } from "@/lib/admin/cotizacion-calc";
import {
  WIZARD_TABS,
  TABS_BLOQUEABLES,
  isSistemaCompleto,
  evaluarCotizacionLista,
} from "@/lib/admin/cotizacion-wizard";
import { actualizarCotizacionItems } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import type {
  CatalogoOption,
  CotizacionDetalle,
} from "@/lib/admin/queries";

export interface CotizacionBuilderProps {
  detalle: CotizacionDetalle;
  catalogo: ReadonlyArray<CatalogoOption>;
  /** RBAC cotizaciones:edit -> habilita edicion de partidas y datos del sistema. */
  puedeEditar: boolean;
  /** RBAC documentos:edit -> habilita subida/borrado de documentos. */
  puedeEditarDocs: boolean;
}

type TabId = "sistema" | "partidas" | "documentos" | "historial";

interface TabDef {
  id: TabId;
  label: string;
  count: number;
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
 * Constructor/detalle de cotizacion (D4). Client component que organiza el
 * detalle 360 en pestañas (Partidas, Sistema, Documentos, Historial) más una
 * columna lateral con relaciones, totales y acciones de estado.
 *
 *  - Partidas: estado local de partidas (ItemUI[]) con totales calculados en
 *    vivo, alta (catalogo o manual), edicion/borrado fila a fila y guardado via
 *    Server Action en useTransition; reconcilia los totales devueltos por el
 *    servidor (si los devuelve) y refresca la ruta.
 *  - Sistema: especificaciones de solo lectura (SistemaFields) + SistemaForm
 *    para editar la cabecera (sizing, produccion, esquema, vigencia).
 *  - Documentos: CotizacionDocumentosPanel (subida/borrado segun RBAC docs).
 *  - Historial: CotizacionHistorial (timeline de eventos).
 *
 * Si !puedeEditar, las partidas y el sistema son solo lectura (sin AddItem, sin
 * guardar, filas bloqueadas, sin SistemaForm ni acciones de estado).
 */
export function CotizacionBuilder({
  detalle,
  catalogo,
  puedeEditar,
  puedeEditarDocs,
}: CotizacionBuilderProps) {
  const router = useRouter();
  const { cotizacion } = detalle;

  // Gate del wizard: el paso Sistema habilita las demas pestañas.
  const sistemaCompleto = isSistemaCompleto(cotizacion);

  // Por defecto arrancamos en Sistema (paso 1 del wizard); si !sistemaCompleto
  // es ademas el unico paso accesible.
  const [tab, setTab] = useState<TabId>("sistema");
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

  const itemsCount = items.length;

  const { lista, faltantes } = evaluarCotizacionLista({
    sistemaCompleto,
    itemsCount,
    total: totales.total,
  });

  // Conteos por pestaña, indexados por id.
  const counts: Record<TabId, number> = {
    sistema: 0,
    partidas: itemsCount,
    documentos: detalle.documentos.length,
    historial: detalle.timeline.length,
  };

  // Orden del wizard (Sistema primero) tomado del modulo de logica pura.
  const tabs: ReadonlyArray<TabDef> = WIZARD_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: counts[t.id],
  }));

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
      {/* Columna principal: pestañas del detalle 360 */}
      <div className="space-y-4 lg:col-span-2">
        {/* Barra de tabs */}
        <div
          role="tablist"
          aria-label="Secciones de la cotización"
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {tabs.map((t) => {
            const bloqueada = !sistemaCompleto && TABS_BLOQUEABLES.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                disabled={bloqueada}
                aria-disabled={bloqueada}
                title={
                  bloqueada
                    ? "Completa el paso Sistema para continuar"
                    : undefined
                }
                onClick={() => {
                  if (bloqueada) return;
                  setTab(t.id);
                }}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  tab === t.id
                    ? "border-brand text-brand dark:border-primary dark:text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  bloqueada && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
                )}
              >
                {t.label}
                {t.count > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Panel activo */}
        <div role="tabpanel">
          {/* Partidas */}
          {tab === "partidas" ? (
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
                  <p
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
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
          ) : null}

          {/* Sistema */}
          {tab === "sistema" ? (
            <Card>
              <CardHeader>
                <CardTitle>Sistema</CardTitle>
                <CardDescription>
                  Dimensionamiento y metricas energeticas.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4 space-y-4">
                <SistemaWizardStep
                  cotizacionId={cotizacion.id}
                  cabecera={cotizacion}
                  calcContext={detalle.calcContext}
                  itemsCount={itemsCount}
                  puedeEditar={puedeEditar}
                />
                <SistemaFields
                  capacidadKwp={cotizacion.capacidadKwp}
                  paneles={cotizacion.paneles}
                  inversor={cotizacion.inversor}
                  produccionAnualKwh={cotizacion.produccionAnualKwh}
                  ahorroAnualMxn={cotizacion.ahorroAnualMxn}
                  paybackAnios={cotizacion.paybackAnios}
                  esquema={cotizacion.esquema}
                />
                <SistemaForm
                  cotizacionId={cotizacion.id}
                  datos={cotizacion}
                  puedeEditar={puedeEditar}
                />
                <CotizacionPaquetePanel
                  cotizacionId={cotizacion.id}
                  capacidadKwp={cotizacion.capacidadKwp}
                  puedeEditar={puedeEditar}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Documentos */}
          {tab === "documentos" ? (
            <Card>
              <CardHeader>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>
                  Archivos asociados a esta cotización.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <CotizacionDocumentosPanel
                  cotizacionId={cotizacion.id}
                  documentos={detalle.documentos}
                  puedeEditar={puedeEditarDocs}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Historial */}
          {tab === "historial" ? (
            <Card>
              <CardHeader>
                <CardTitle>Historial</CardTitle>
                <CardDescription>
                  Actividad registrada para esta cotización.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <CotizacionHistorial timeline={detalle.timeline} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Columna lateral: relaciones + totales + acciones de estado */}
      <div className="space-y-6">
        <RelacionesCard
          cliente={detalle.cliente}
          oportunidad={detalle.oportunidad}
        />

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
                lista={lista}
                faltantes={faltantes}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
