"use client"

import { useEffect, useMemo, useState } from "react"

import type {
  CotizacionRow,
  CotizacionesKpis as CotizacionesKpisData,
  VendedorOption,
} from "@/lib/admin/queries"
import {
  CotizacionesFilters,
  FILTROS_INICIALES,
  SIN_ASIGNAR,
  type CotizacionesFiltrosUI,
} from "@/components/admin/cotizaciones/cotizaciones-filters"
import { CotizacionesKpis } from "@/components/admin/cotizaciones/cotizaciones-kpis"
import { CotizacionesTable } from "@/components/admin/cotizaciones/cotizaciones-table"

export interface CotizacionesViewProps {
  cotizacionesIniciales: ReadonlyArray<CotizacionRow>
  vendedores: ReadonlyArray<VendedorOption>
  /** KPIs agregados del scope (total, montos por estado, conteo por estado). */
  kpis: CotizacionesKpisData
  /** RBAC cotizaciones:edit -> habilita acciones de edicion (reservado). */
  puedeEditar: boolean
  /** vendedor/preventa: oculta el filtro de vendedor. */
  rolScoped: boolean
}

/** Normaliza texto para busqueda: minusculas y sin acentos (marcas diacriticas). */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/**
 * Contenedor cliente del listado de cotizaciones. Mantiene el estado de filtros
 * (estado / vendedor / busqueda por folio o cliente) con una busqueda con
 * debounce simple y filtra las cotizaciones ya cargadas con useMemo. Renderiza
 * la barra de filtros y la tabla.
 */
export function CotizacionesView({
  cotizacionesIniciales,
  vendedores,
  kpis,
  rolScoped,
}: CotizacionesViewProps) {
  const [filtros, setFiltros] = useState<CotizacionesFiltrosUI>(FILTROS_INICIALES)

  // Debounce simple de la busqueda: el input actualiza filtros.busqueda de
  // inmediato, pero el termino efectivo se aplica 250 ms despues.
  const [busquedaEfectiva, setBusquedaEfectiva] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaEfectiva(filtros.busqueda)
    }, 250)
    return () => clearTimeout(timer)
  }, [filtros.busqueda])

  // Filtrado en cliente sobre los datos ya cargados (inmutable: nuevo array).
  const cotizacionesFiltradas = useMemo(() => {
    const termino = normalizar(busquedaEfectiva.trim())

    return cotizacionesIniciales.filter((cotizacion) => {
      if (filtros.estado !== null && cotizacion.estado !== filtros.estado) {
        return false
      }

      if (filtros.vendedor !== null) {
        if (filtros.vendedor === SIN_ASIGNAR) {
          if (cotizacion.vendedorId !== null) return false
        } else if (cotizacion.vendedorId !== filtros.vendedor) {
          return false
        }
      }

      if (termino !== "") {
        const campos = normalizar(
          [cotizacion.folio, cotizacion.clienteNombre]
            .filter(Boolean)
            .join(" ")
        )
        if (!campos.includes(termino)) return false
      }

      return true
    })
  }, [cotizacionesIniciales, busquedaEfectiva, filtros])

  return (
    <div className="flex flex-col gap-4">
      <CotizacionesKpis kpis={kpis} />

      <CotizacionesFilters
        filtros={filtros}
        onChange={setFiltros}
        vendedores={vendedores}
        rolScoped={rolScoped}
      />

      <CotizacionesTable rows={cotizacionesFiltradas} />
    </div>
  )
}
