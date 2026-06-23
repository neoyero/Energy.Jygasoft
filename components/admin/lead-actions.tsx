"use client";

import { useTransition } from "react";
import { updateLeadEstado, convertLead } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

const ESTADOS = [
  "nuevo",
  "sin_calificar",
  "en_nutricion",
  "calificado",
  "asignado",
  "convertido",
  "perdido",
  "descartado",
] as const;

type Estado = (typeof ESTADOS)[number];

export function LeadActions({
  leadId,
  estado,
}: {
  leadId: string;
  estado: Estado;
}) {
  const [pending, startTransition] = useTransition();
  const convertido = estado === "convertido";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-muted-foreground">Estado</label>
      <select
        defaultValue={estado}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => updateLeadEstado(leadId, e.target.value as Estado))
        }
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      >
        {ESTADOS.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <Button
        size="sm"
        disabled={pending || convertido}
        onClick={() => startTransition(() => convertLead(leadId))}
      >
        {convertido ? "Convertido" : "Convertir a cliente + oportunidad"}
      </Button>
    </div>
  );
}
