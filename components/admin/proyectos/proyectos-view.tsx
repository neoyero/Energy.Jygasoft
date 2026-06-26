"use client"

import { useEffect, useMemo, useState } from "react"

import type { ProyectoRow, VendedorOption } from "@/lib/admin/queries"
import {
  ProyectosFilters,
  FILTROS_INICIALES,
  SIN_ASIGNAR,
  type ProyectosFiltrosUI,
} from "@/components/admin/proyectos/proyectos-filters"
import { ProyectosTable } from "@/components/admin/proyectos/proyectos-table"

export interface ProyectosViewProps {
  proyectos: ReadonlyArray<ProyectoRow>
  vendedores: ReadonlyArray<VendedorOption>
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
 * Contenedor cliente del listado de proyectos. Mantiene el estado de filtros,
 * aplica una busqueda con debounce simple y filtra los proyectos ya cargados con
 * useMemo (normaliza acentos sobre folio + cliente + vendedor). No hay alta de
 * proyecto en D5: la edicion vive en el detalle.
 */
export function ProyectosView({
  proyectos,
  vendedores,
  rolScoped,
}: ProyectosViewProps) {
  const [filtros, setFiltros] = useState<ProyectosFiltrosUI>(FILTROS_INICIALES)

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
  const proyectosFiltrados = useMemo(() => {
    const termino = normalizar(busquedaEfectiva.trim())

    return proyectos.filter((proyecto) => {
      if (filtros.fase !== null && proyecto.fase !== filtros.fase) {
        return false
      }

      if (filtros.vendedor !== null) {
        if (filtros.vendedor === SIN_ASIGNAR) {
          if (proyecto.vendedorId !== null) return false
        } else if (proyecto.vendedorId !== filtros.vendedor) {
          return false
        }
      }

      if (termino !== "") {
        const campos = normalizar(
          [
            proyecto.folio,
            proyecto.clienteNombre,
            proyecto.vendedorNombre,
          ]
            .filter(Boolean)
            .join(" ")
        )
        if (!campos.includes(termino)) return false
      }

      return true
    })
  }, [proyectos, busquedaEfectiva, filtros])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ProyectosFilters
          filtros={filtros}
          onChange={setFiltros}
          vendedores={vendedores}
          rolScoped={rolScoped}
        />
      </div>

      {/* Tabla */}
      <ProyectosTable rows={proyectosFiltrados} />
    </div>
  )
}
