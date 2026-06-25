"use client";

import type { DragEvent } from "react";
import { GripVertical, User, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMXN, fmtFechaRel } from "@/lib/admin/format";
import type { OportunidadRow } from "@/lib/admin/queries";

export interface DealCardProps {
  /** Oportunidad a renderizar. */
  oportunidad: OportunidadRow;
  /** Habilita arrastrar (solo si el usuario puede editar). */
  draggable: boolean;
  /** Handler de inicio de arrastre (set del dataTransfer lo hace el board). */
  onDragStart?: (e: DragEvent<HTMLElement>, id: string) => void;
}

/**
 * Tarjeta presentacional de una oportunidad (deal) dentro del kanban del
 * pipeline. Sin estado propio: el board controla el drag & drop. Estilo Card de
 * marca (borde stone, rounded-2xl, superficie blanca / card en oscuro).
 */
export function DealCard({ oportunidad, draggable, onDragStart }: DealCardProps) {
  const o = oportunidad;
  const cuenta = o.clienteNombre ?? o.leadNombre ?? "—";
  const fechaCierre =
    o.fechaCierreEstimada !== null ? fmtFechaRel(o.fechaCierreEstimada) : null;

  return (
    <article
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, o.id) : undefined}
      data-deal-id={o.id}
      className={cn(
        "group rounded-2xl border border-stone-200/70 bg-white p-3 text-stone-900 shadow-sm",
        "dark:border-border dark:bg-card dark:text-card-foreground",
        draggable
          ? "cursor-grab transition-shadow hover:border-stone-300 hover:shadow-md active:cursor-grabbing"
          : "cursor-default",
      )}
    >
      <div className="flex items-start gap-2">
        {draggable ? (
          <GripVertical
            className="mt-0.5 size-4 shrink-0 text-stone-300 transition-colors group-hover:text-stone-400"
            aria-hidden="true"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-brand dark:text-foreground">
            {o.nombre}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{cuenta}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-brand-green-dark dark:text-brand-green">
          {formatMXN(o.montoEstimado)}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium tabular-nums text-muted-foreground">
          {o.probabilidad}%
        </span>
      </div>

      {fechaCierre ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
          <span>Cierre {fechaCierre}</span>
        </p>
      ) : null}
    </article>
  );
}
