"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { labelFor } from "@/components/admin/ui/status-badge";
import type { CatalogoOption } from "@/lib/admin/queries";
import type { ItemUI } from "@/components/admin/cotizaciones/item-editor-row";
import { cn } from "@/lib/utils";

export interface AddItemControlProps {
  catalogo: ReadonlyArray<CatalogoOption>;
  /** Recibe la nueva partida (sin `key`; el builder asigna el key efimero). */
  onAdd: (item: Omit<ItemUI, "key">) => void;
  disabled?: boolean;
  className?: string;
}

const MANUAL = "__manual__";

const selectClasses = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm",
  "text-foreground transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50",
);

const fieldLabel = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Descripcion legible de una opcion del catalogo (tipo · marca modelo). */
function describeOption(opt: CatalogoOption): string {
  const marcaModelo = [opt.marca, opt.modelo].filter(Boolean).join(" ");
  const base = marcaModelo || labelFor(opt.tipo);
  return `${labelFor(opt.tipo)} · ${base}`;
}

/**
 * Control para anadir una partida. Un select del catalogo (autorrellena
 * descripcion=marca/modelo y precio) o la opcion "Partida manual" (campos
 * vacios). El boton emite la partida via onAdd y resetea la seleccion.
 */
export function AddItemControl({
  catalogo,
  onAdd,
  disabled = false,
  className,
}: AddItemControlProps) {
  const [selected, setSelected] = useState<string>(MANUAL);

  function handleAdd() {
    if (selected === MANUAL) {
      onAdd({
        equipoId: null,
        descripcion: "",
        cantidad: 1,
        precioUnitario: 0,
      });
      return;
    }

    const opt = catalogo.find((c) => c.id === selected);
    if (!opt) {
      onAdd({ equipoId: null, descripcion: "", cantidad: 1, precioUnitario: 0 });
      return;
    }

    const marcaModelo = [opt.marca, opt.modelo].filter(Boolean).join(" ");
    onAdd({
      equipoId: opt.id,
      descripcion: marcaModelo || labelFor(opt.tipo),
      cantidad: 1,
      precioUnitario: opt.precio ?? 0,
    });

    // Tras anadir desde catalogo, volvemos a "manual" para evitar duplicados
    // accidentales con doble clic.
    setSelected(MANUAL);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end",
        className,
      )}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className={fieldLabel}>Agregar desde catalogo</span>
        <select
          value={selected}
          disabled={disabled}
          className={selectClasses}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value={MANUAL}>Partida manual</option>
          {catalogo.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {describeOption(opt)}
            </option>
          ))}
        </select>
      </label>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={handleAdd}
      >
        <Plus aria-hidden />
        Agregar partida
      </Button>
    </div>
  );
}
