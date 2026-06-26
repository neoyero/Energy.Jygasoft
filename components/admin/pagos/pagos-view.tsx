"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import type { PagoRow, PagosTotales } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import {
  PagosFilters,
  FILTROS_INICIALES,
  type PagosFiltrosUI,
} from "@/components/admin/pagos/pagos-filters"
import { PagosTable } from "@/components/admin/pagos/pagos-table"
import { PagoForm } from "@/components/admin/pagos/pago-form"

export interface PagosViewProps {
  pagos: ReadonlyArray<PagoRow>
  totales: PagosTotales
  /** RBAC pagos:edit -> habilita alta, edición y acciones de fila. */
  puedeEditar: boolean
}

/** Estado del formulario plegable: crear nuevo o editar un pago concreto. */
type FormEstado =
  | { abierto: false }
  | { abierto: true; modo: "crear" }
  | { abierto: true; modo: "editar"; pago: PagoRow }

/** Normaliza texto para búsqueda: minúsculas y sin acentos (marcas diacríticas). */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * Contenedor cliente del listado de pagos. Mantiene el estado de filtros,
 * aplica una búsqueda con debounce simple y filtra los pagos ya cargados con
 * useMemo (normaliza acentos). El botón "Nuevo pago" abre el formulario de alta
 * en una sección plegable; "Editar" en la tabla lo abre en modo edición.
 */
export function PagosView({ pagos, totales: _totales, puedeEditar }: PagosViewProps) {
  const [filtros, setFiltros] = useState<PagosFiltrosUI>(FILTROS_INICIALES)
  const [form, setForm] = useState<FormEstado>({ abierto: false })

  // Debounce simple de la búsqueda: el input actualiza filtros.busqueda de
  // inmediato, pero el término efectivo se aplica 250 ms después.
  const [busquedaEfectiva, setBusquedaEfectiva] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaEfectiva(filtros.busqueda)
    }, 250)
    return () => clearTimeout(timer)
  }, [filtros.busqueda])

  // Filtrado en cliente sobre los datos ya cargados (inmutable: nuevo array).
  const pagosFiltrados = useMemo(() => {
    const termino = normalizar(busquedaEfectiva.trim())

    return pagos.filter((pago) => {
      if (filtros.estado !== null && pago.estado !== filtros.estado) {
        return false
      }

      if (filtros.soloVencidos && !pago.vencido) {
        return false
      }

      if (termino !== "") {
        const campos = normalizar(
          [pago.concepto, pago.proyectoFolio, pago.clienteNombre]
            .filter(Boolean)
            .join(" ")
        )
        if (!campos.includes(termino)) return false
      }

      return true
    })
  }, [pagos, busquedaEfectiva, filtros])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros + acción de alta */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PagosFilters filtros={filtros} onChange={setFiltros} />

        {puedeEditar ? (
          <Button
            type="button"
            size="sm"
            variant={form.abierto ? "outline" : "default"}
            onClick={() =>
              setForm((prev) =>
                prev.abierto ? { abierto: false } : { abierto: true, modo: "crear" }
              )
            }
          >
            {form.abierto ? (
              <>
                <X className="size-4" aria-hidden />
                Cerrar
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                Nuevo pago
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* Form de alta/edición (plegable) */}
      {puedeEditar && form.abierto ? (
        <PagoForm
          key={form.modo === "editar" ? form.pago.id : "crear"}
          modo={form.modo}
          pago={form.modo === "editar" ? form.pago : undefined}
          onSuccess={() => setForm({ abierto: false })}
        />
      ) : null}

      {/* Tabla */}
      <PagosTable
        rows={pagosFiltrados}
        puedeEditar={puedeEditar}
        onEditar={(pago) => setForm({ abierto: true, modo: "editar", pago })}
      />
    </div>
  )
}
