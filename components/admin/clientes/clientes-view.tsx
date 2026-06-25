"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import type { ClienteRow, VendedorOption } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import {
  ClientesFilters,
  FILTROS_INICIALES,
  SIN_ASIGNAR,
  type ClientesFiltrosUI,
} from "@/components/admin/clientes/clientes-filters"
import { ClientesTable } from "@/components/admin/clientes/clientes-table"
import { ClienteForm } from "@/components/admin/clientes/cliente-form"

export interface ClientesViewProps {
  clientesIniciales: ReadonlyArray<ClienteRow>
  vendedores: ReadonlyArray<VendedorOption>
  /** RBAC clientes:edit -> habilita el alta de cliente. */
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
 * Contenedor cliente del listado de clientes. Mantiene el estado de filtros,
 * aplica una busqueda con debounce simple y filtra los clientes ya cargados con
 * useMemo (normaliza acentos). El boton "Nuevo cliente" abre el formulario de
 * alta en una seccion plegable.
 */
export function ClientesView({
  clientesIniciales,
  vendedores,
  puedeEditar,
  rolScoped,
}: ClientesViewProps) {
  const [filtros, setFiltros] = useState<ClientesFiltrosUI>(FILTROS_INICIALES)
  const [creando, setCreando] = useState(false)

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
  const clientesFiltrados = useMemo(() => {
    const termino = normalizar(busquedaEfectiva.trim())

    return clientesIniciales.filter((cliente) => {
      if (
        filtros.tipoPersona !== null &&
        cliente.tipoPersona !== filtros.tipoPersona
      ) {
        return false
      }

      if (filtros.vendedor !== null) {
        if (filtros.vendedor === SIN_ASIGNAR) {
          if (cliente.vendedorId !== null) return false
        } else if (cliente.vendedorId !== filtros.vendedor) {
          return false
        }
      }

      if (termino !== "") {
        const campos = normalizar(
          [
            cliente.nombre,
            cliente.rfc,
            cliente.email,
            cliente.telefono,
            cliente.municipio,
            cliente.estadoMx,
          ]
            .filter(Boolean)
            .join(" ")
        )
        if (!campos.includes(termino)) return false
      }

      return true
    })
  }, [clientesIniciales, busquedaEfectiva, filtros])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros + accion de alta */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ClientesFilters
          filtros={filtros}
          onChange={setFiltros}
          vendedores={vendedores}
          rolScoped={rolScoped}
        />

        {puedeEditar ? (
          <Button
            type="button"
            size="sm"
            variant={creando ? "outline" : "default"}
            onClick={() => setCreando((prev) => !prev)}
          >
            {creando ? (
              <>
                <X className="size-4" aria-hidden />
                Cerrar
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                Nuevo cliente
              </>
            )}
          </Button>
        ) : null}
      </div>

      {/* Form de alta (plegable) */}
      {puedeEditar && creando ? (
        <ClienteForm
          modo="crear"
          vendedores={vendedores}
          onSuccess={() => setCreando(false)}
        />
      ) : null}

      {/* Tabla */}
      <ClientesTable rows={clientesFiltrados} />
    </div>
  )
}
