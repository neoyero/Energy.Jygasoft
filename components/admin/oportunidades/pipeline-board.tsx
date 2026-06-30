"use client";

import { useMemo, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Wallet, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMXN, formatInt } from "@/lib/admin/format";
import { labelFor } from "@/components/admin/ui/status-badge";
import { StatCard } from "@/components/admin/ui/stat-card";
import type {
  OportunidadRow,
  PipelineData,
  VendedorOption,
} from "@/lib/admin/queries";
import { updateOportunidadEtapa } from "@/lib/admin/actions";
import { oportunidadEtapa } from "@/db/schema";
import {
  ETAPAS_CERRADAS,
  PROBABILIDAD_POR_ETAPA,
} from "@/lib/admin/pipeline";
import { DealCard } from "@/components/admin/oportunidades/deal-card";
import { Modal } from "@/components/admin/ui/modal";
import { ActividadForm } from "@/components/admin/actividades/actividad-form";

// Orden canónico de etapas = orden del enum. Local (desde @/db/schema, sin `pg`)
// para no arrastrar la BD al bundle del cliente.
const ETAPA_ORDER = oportunidadEtapa.enumValues;

type Etapa = (typeof oportunidadEtapa.enumValues)[number];

export interface PipelineBoardProps {
  data: PipelineData;
  puedeEditar: boolean;
  /** RBAC actividades:edit -> habilita "Agendar seguimiento" por tarjeta. */
  puedeAgendar?: boolean;
  /** Vendedores asignables (para el alta rápida de actividad). */
  vendedores?: ReadonlyArray<VendedorOption>;
}

/** Rango de una etapa en el orden canonico (etapas desconocidas al final). */
function rank(etapa: string): number {
  const i = (ETAPA_ORDER as readonly string[]).indexOf(etapa);
  return i === -1 ? ETAPA_ORDER.length : i;
}

/** Columnas del kanban = enum de etapas ordenado por ETAPA_ORDER. */
const COLUMNAS: readonly Etapa[] = [...oportunidadEtapa.enumValues].sort(
  (a, b) => rank(a) - rank(b),
);

/**
 * Tablero kanban del pipeline con drag & drop NATIVO (HTML5, sin dependencias).
 * Estado local de oportunidades para mover de forma optimista; en error de la
 * Server Action se revierte y se refresca. Si `puedeEditar` es false, es solo
 * lectura (sin draggable ni handlers de drop).
 */
export function PipelineBoard({
  data,
  puedeEditar,
  puedeAgendar = false,
  vendedores = [],
}: PipelineBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [oportunidades, setOportunidades] = useState<OportunidadRow[]>(
    data.oportunidades,
  );
  const [overEtapa, setOverEtapa] = useState<Etapa | null>(null);
  // Acceso rápido a "Agendar seguimiento": id de la oportunidad activa + saving.
  const [agendarId, setAgendarId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reagrupa por etapa cada vez que cambia el estado local.
  const porEtapa = useMemo(() => {
    const mapa = new Map<Etapa, OportunidadRow[]>();
    for (const etapa of COLUMNAS) mapa.set(etapa, []);
    for (const o of oportunidades) {
      const lista = mapa.get(o.etapa as Etapa);
      if (lista) lista.push(o);
    }
    return mapa;
  }, [oportunidades]);

  // KPIs derivados del estado VIVO (se recalculan al arrastrar): solo etapas
  // abiertas (excluye ganada/perdida).
  const kpis = useMemo(() => {
    const abiertas = oportunidades.filter((o) => !ETAPAS_CERRADAS.has(o.etapa));
    return {
      forecast: abiertas.reduce((acc, o) => acc + o.montoPonderado, 0),
      montoAbierto: abiertas.reduce((acc, o) => acc + o.montoEstimado, 0),
      conteo: abiertas.length,
    };
  }, [oportunidades]);

  function handleDragStart(e: DragEvent<HTMLElement>, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function moverOptimista(id: string, etapa: Etapa) {
    const previo = oportunidades;
    const actual = oportunidades.find((o) => o.id === id);
    if (!actual || actual.etapa === etapa) return;

    // Update optimista inmutable. La probabilidad la define la NUEVA etapa
    // (modelo de embudo), y el ponderado se recalcula con ella.
    setOportunidades((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const probabilidad = PROBABILIDAD_POR_ETAPA[etapa];
        return {
          ...o,
          etapa,
          probabilidad,
          montoPonderado: (o.montoEstimado * probabilidad) / 100,
        };
      }),
    );

    startTransition(async () => {
      try {
        await updateOportunidadEtapa(id, etapa);
        router.refresh();
      } catch {
        // Revertir al estado previo ante un fallo de la action.
        setOportunidades(previo);
      }
    });
  }

  function handleDrop(e: DragEvent<HTMLElement>, etapa: Etapa) {
    e.preventDefault();
    setOverEtapa(null);
    if (!puedeEditar) return;
    const id = e.dataTransfer.getData("text/plain");
    if (id) moverOptimista(id, etapa);
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Forecast ponderado"
          value={formatMXN(kpis.forecast)}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Monto abierto"
          value={formatMXN(kpis.montoAbierto)}
          icon={Wallet}
          accent="gold"
        />
        <StatCard
          label="Oportunidades abiertas"
          value={formatInt(kpis.conteo)}
          icon={Target}
          accent="brand"
        />
      </section>

      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-4",
          isPending && "opacity-95",
        )}
      >
        {COLUMNAS.map((etapa) => {
        const items = porEtapa.get(etapa) ?? [];
        const ponderado = items.reduce(
          (acc, o) => acc + o.montoPonderado,
          0,
        );
        const isOver = overEtapa === etapa;

        return (
          <section
            key={etapa}
            onDragOver={
              puedeEditar
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }
                : undefined
            }
            onDragEnter={
              puedeEditar ? () => setOverEtapa(etapa) : undefined
            }
            onDragLeave={
              puedeEditar
                ? (e) => {
                    // Solo limpiar si salimos de la columna (no de un hijo).
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setOverEtapa((prev) => (prev === etapa ? null : prev));
                    }
                  }
                : undefined
            }
            onDrop={puedeEditar ? (e) => handleDrop(e, etapa) : undefined}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-2xl border bg-stone-50/60 p-2 transition-colors",
              "dark:bg-muted/30",
              isOver
                ? "border-brand-green/60 bg-brand-green/5 dark:border-brand-green/60"
                : "border-stone-200/70 dark:border-border",
            )}
          >
            <header className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-brand dark:text-foreground">
                  {labelFor(etapa)}
                </h2>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatMXN(ponderado)}
              </span>
            </header>

            <div className="mt-1 flex flex-1 flex-col gap-2">
              {items.length > 0 ? (
                items.map((o) => (
                  <DealCard
                    key={o.id}
                    oportunidad={o}
                    draggable={puedeEditar}
                    onDragStart={handleDragStart}
                    etapas={
                      puedeEditar
                        ? COLUMNAS.filter((e) => e !== o.etapa).map((e) => ({
                            value: e,
                            label: labelFor(e),
                          }))
                        : undefined
                    }
                    onMover={
                      puedeEditar
                        ? (etapa) => moverOptimista(o.id, etapa as Etapa)
                        : undefined
                    }
                    onAgendar={
                      puedeAgendar ? (id) => setAgendarId(id) : undefined
                    }
                  />
                ))
              ) : (
                <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-muted-foreground dark:border-border">
                  Vacío
                </p>
              )}
            </div>
          </section>
        );
      })}
      </div>

      {/* Acceso rápido: alta de actividad ligada a la oportunidad seleccionada. */}
      {puedeAgendar ? (
        <Modal
          open={agendarId !== null}
          onOpenChange={(abierto) => {
            if (!abierto) setAgendarId(null);
          }}
          title="Agendar seguimiento"
          description="Crea una actividad ligada a esta oportunidad."
          size="2xl"
          dismissable={!saving}
        >
          {agendarId ? (
            <ActividadForm
              key={agendarId}
              modo="crear"
              entidadFija={{ tipo: "oportunidad", id: agendarId }}
              vendedores={vendedores}
              onSuccess={() => setAgendarId(null)}
              onCancel={() => setAgendarId(null)}
              onSavingChange={setSaving}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
