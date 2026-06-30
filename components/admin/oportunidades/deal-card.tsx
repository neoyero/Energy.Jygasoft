"use client";

import type { DragEvent } from "react";
import { Menu } from "@base-ui/react/menu";
import { GripVertical, User, CalendarClock, MoveRight, CalendarPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMXN, fmtFechaRel } from "@/lib/admin/format";
import type { OportunidadRow } from "@/lib/admin/queries";

/** Opción de etapa destino para el menú "Mover a". */
export interface EtapaOption {
  value: string;
  label: string;
}

export interface DealCardProps {
  /** Oportunidad a renderizar. */
  oportunidad: OportunidadRow;
  /** Habilita arrastrar (solo si el usuario puede editar). */
  draggable: boolean;
  /** Handler de inicio de arrastre (set del dataTransfer lo hace el board). */
  onDragStart?: (e: DragEvent<HTMLElement>, id: string) => void;
  /** Etapas destino (sin la actual) para el menú de mover por tap. */
  etapas?: ReadonlyArray<EtapaOption>;
  /** Mueve la oportunidad a otra etapa (alternativa táctil al drag). */
  onMover?: (etapa: string) => void;
  /** Abre el alta de actividad para esta oportunidad (acceso rápido). */
  onAgendar?: (id: string) => void;
}

/**
 * Tarjeta presentacional de una oportunidad (deal) dentro del kanban del
 * pipeline. Sin estado propio: el board controla el drag & drop. Estilo Card de
 * marca (borde stone, rounded-2xl, superficie blanca / card en oscuro).
 */
export function DealCard({
  oportunidad,
  draggable,
  onDragStart,
  etapas,
  onMover,
  onAgendar,
}: DealCardProps) {
  const o = oportunidad;
  const cuenta = o.clienteNombre ?? o.leadNombre ?? "—";
  const fechaCierre =
    o.fechaCierreEstimada !== null ? fmtFechaRel(o.fechaCierreEstimada) : null;
  const puedeMover = Boolean(onMover && etapas && etapas.length > 0);
  const mostrarMenu = puedeMover || Boolean(onAgendar);

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

        {mostrarMenu ? (
          <Menu.Root>
            <Menu.Trigger
              // No iniciar arrastre desde el botón del menú.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              aria-label="Acciones de la oportunidad"
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors",
                "hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-muted",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "pointer-coarse:size-10",
              )}
            >
              <MoveRight className="size-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
                <Menu.Popup
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "min-w-44 origin-[var(--transform-origin)] rounded-xl border border-stone-200 bg-white p-1 shadow-lg",
                    "text-sm text-stone-700 dark:border-border dark:bg-popover dark:text-popover-foreground",
                    "outline-none",
                  )}
                >
                  {onAgendar ? (
                    <Menu.Item
                      onClick={(e) => {
                        e.stopPropagation();
                        onAgendar(o.id);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 outline-none select-none",
                        "data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-muted",
                      )}
                    >
                      <CalendarPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      Agendar seguimiento
                    </Menu.Item>
                  ) : null}

                  {puedeMover ? (
                    <>
                      <p className="px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Mover a
                      </p>
                      {etapas!.map((et) => (
                        <Menu.Item
                          key={et.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMover!(et.value);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center rounded-lg px-2.5 py-2 outline-none select-none",
                            "data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-muted",
                          )}
                        >
                          {et.label}
                        </Menu.Item>
                      ))}
                    </>
                  ) : null}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
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
