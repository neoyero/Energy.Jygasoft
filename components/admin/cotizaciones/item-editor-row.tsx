"use client";

import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMXN } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

/**
 * Partida en edicion en el cliente. `key` es un identificador efimero estable
 * (no persiste en BD) para el render de la lista; el resto son los campos
 * editables que se enviaran a la Server Action.
 */
export interface ItemUI {
  key: string;
  equipoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ItemEditorRowProps {
  item: ItemUI;
  /** Devuelve una copia con el cambio aplicado (patron inmutable). */
  onChange: (next: ItemUI) => void;
  onRemove: () => void;
  /** Si es true, toda la fila es solo lectura. */
  readOnly?: boolean;
}

const fieldLabel = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Parsea un input numerico a number, tratando vacio/NaN como 0. */
function toNumber(raw: string): number {
  if (raw.trim() === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Fila controlada de edicion de partida: descripcion / cantidad / precio
 * unitario editables, importe calculado (cantidad * precio) y boton de borrar.
 * No muta el item recibido: emite copias via onChange.
 */
export function ItemEditorRow({
  item,
  onChange,
  onRemove,
  readOnly = false,
}: ItemEditorRowProps) {
  const importe = item.cantidad * item.precioUnitario;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-xl border border-border p-3",
        "sm:grid-cols-[1fr_5rem_8rem_8rem_auto] sm:items-end",
      )}
    >
      {/* Descripcion */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Descripcion</span>
        <Input
          value={item.descripcion}
          disabled={readOnly}
          placeholder="Descripcion de la partida"
          onChange={(e) => onChange({ ...item, descripcion: e.target.value })}
        />
      </label>

      {/* Cantidad */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Cantidad</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={String(item.cantidad)}
          disabled={readOnly}
          className="text-right tabular-nums"
          onChange={(e) =>
            onChange({ ...item, cantidad: toNumber(e.target.value) })
          }
        />
      </label>

      {/* Precio unitario */}
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>P. unitario</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={String(item.precioUnitario)}
          disabled={readOnly}
          className="text-right tabular-nums"
          onChange={(e) =>
            onChange({ ...item, precioUnitario: toNumber(e.target.value) })
          }
        />
      </label>

      {/* Importe (solo lectura) */}
      <div className="flex flex-col gap-1">
        <span className={fieldLabel}>Importe</span>
        <span className="flex h-8 items-center justify-end px-1 text-sm font-medium tabular-nums text-foreground">
          {formatMXN(importe)}
        </span>
      </div>

      {/* Borrar */}
      <div className="flex justify-end sm:pb-0.5">
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          disabled={readOnly}
          aria-label="Eliminar partida"
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}
