"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Search } from "lucide-react"

import { buscarEntidadActividad } from "@/lib/admin/actions"
import type { EntidadOpcion } from "@/lib/admin/queries"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  ENTIDAD_LABEL,
  ENTIDAD_PICKER_TIPOS,
  type EntidadPickerTipo,
} from "@/components/admin/actividades/actividad-utils"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

export interface EntidadSeleccionada {
  tipo: EntidadPickerTipo
  id: string
  label: string
}

export interface EntidadPickerProps {
  value: EntidadSeleccionada | null
  onChange: (value: EntidadSeleccionada | null) => void
  disabled?: boolean
}

/**
 * Selector de entidad para asociar una actividad: un select de tipo
 * (lead/cliente/oportunidad/cotización/proyecto) + búsqueda con debounce que
 * lista coincidencias (respetando el scope del rol vía la server action).
 */
export function EntidadPicker({ value, onChange, disabled }: EntidadPickerProps) {
  const [tipo, setTipo] = useState<EntidadPickerTipo>(value?.tipo ?? "cliente")
  const [q, setQ] = useState("")
  const [qEf, setQEf] = useState("")
  const [opciones, setOpciones] = useState<EntidadOpcion[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounce de la búsqueda (250 ms).
  useEffect(() => {
    const t = setTimeout(() => setQEf(q), 250)
    return () => clearTimeout(t)
  }, [q])

  // Trae coincidencias al cambiar tipo o término (con guard anti-carrera).
  useEffect(() => {
    let stale = false
    setCargando(true)
    buscarEntidadActividad(tipo, qEf)
      .then((res) => {
        if (!stale) {
          setOpciones(res)
          setCargando(false)
        }
      })
      .catch(() => {
        if (!stale) setCargando(false)
      })
    return () => {
      stale = true
    }
  }, [tipo, qEf])

  // Cierra el dropdown al hacer click fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  function elegirTipo(nuevo: EntidadPickerTipo): void {
    setTipo(nuevo)
    setQ("")
    onChange(null) // al cambiar de tipo se invalida la selección previa
  }

  function elegir(op: EntidadOpcion): void {
    onChange({ tipo, id: op.id, label: op.nombre })
    setAbierto(false)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="ent-tipo">Asociar a</Label>
        <select
          id="ent-tipo"
          value={tipo}
          onChange={(e) => elegirTipo(e.target.value as EntidadPickerTipo)}
          disabled={disabled}
          className={SELECT_CLASS}
        >
          {ENTIDAD_PICKER_TIPOS.map((t) => (
            <option key={t} value={t}>
              {ENTIDAD_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5" ref={boxRef}>
        <Label htmlFor="ent-buscar">{ENTIDAD_LABEL[tipo]}</Label>
        <div className="relative">
          {cargando ? (
            <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          )}
          <Input
            id="ent-buscar"
            value={value ? value.label : q}
            onChange={(e) => {
              if (value) onChange(null)
              setQ(e.target.value)
              setAbierto(true)
            }}
            onFocus={() => setAbierto(true)}
            disabled={disabled}
            placeholder={`Buscar ${ENTIDAD_LABEL[tipo].toLowerCase()}…`}
            className="pl-8"
            autoComplete="off"
          />

          {abierto && !value ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md">
              {opciones.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {cargando ? "Buscando…" : "Sin coincidencias"}
                </li>
              ) : (
                opciones.map((op) => (
                  <li key={op.id}>
                    <button
                      type="button"
                      onClick={() => elegir(op)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                        "hover:bg-muted focus-visible:bg-muted outline-none",
                      )}
                    >
                      <span className="truncate">{op.nombre}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        {value ? (
          <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" aria-hidden /> Seleccionado
          </p>
        ) : null}
      </div>
    </div>
  )
}
