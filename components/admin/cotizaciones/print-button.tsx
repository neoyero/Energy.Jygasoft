"use client";

import { Button } from "@/components/ui/button";

/**
 * Botón cliente mínimo para la vista imprimible de la cotización. Dispara el
 * diálogo de impresión del navegador (window.print()), desde donde el usuario
 * puede imprimir o "Guardar como PDF". Se oculta en la propia impresión via
 * `print:hidden`.
 */
export function PrintButton() {
  return (
    <Button
      type="button"
      variant="default"
      className="print:hidden"
      onClick={() => window.print()}
    >
      Imprimir / Guardar PDF
    </Button>
  );
}
