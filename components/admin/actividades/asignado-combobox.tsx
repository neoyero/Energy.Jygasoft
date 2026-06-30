"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, UserX } from "lucide-react"

import type { VendedorOption } from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const SIN_ASIGNAR = "Sin asignar"

export interface AsignadoComboboxProps {
  /** Id del usuario seleccionado, o "" para sin asignar. */
  value: string
  /** Usuarios asignables (ya acotados por scope en el servidor). */
  options: ReadonlyArray<VendedorOption>
  onChange: (id: string) => void
  disabled?: boolean
  id?: string
}

/** Quita acentos y baja a minúsculas para una búsqueda tolerante. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/**
 * Selector buscable de "Asignado a": un input que, al desplegarse, filtra la
 * lista de usuarios asignables conforme se teclea (cliente). Incluye la opción
 * "Sin asignar". La lista ya viene acotada por la regla de asignación del rol.
 */
export function AsignadoCombobox({
  value,
  options,
  onChange,
  disabled,
  id,
}: AsignadoComboboxProps) {
  const [abierto, setAbierto] = useState(false)
  const [query, setQuery] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)

  const seleccionado = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  )

  const filtradas = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return options
    return options.filter((o) => norm(o.nombre).includes(q))
  }, [options, query])

  // Cierra al hacer click fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  function elegir(nuevo: string): void {
    onChange(nuevo)
    setAbierto(false)
    setQuery("")
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          id={id}
          value={abierto ? query : seleccionado?.nombre ?? ""}
          placeholder={SIN_ASIGNAR}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!abierto) setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          disabled={disabled}
          autoComplete="off"
          className="pr-8"
        />
        <ChevronsUpDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>

      {abierto ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {/* Sin asignar */}
          <li>
            <button
              type="button"
              onClick={() => elegir("")}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none",
                "hover:bg-muted focus-visible:bg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <UserX className="size-4" aria-hidden /> {SIN_ASIGNAR}
              </span>
              {value === "" ? <Check className="size-4 text-emerald-600" aria-hidden /> : null}
            </button>
          </li>

          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>
          ) : (
            filtradas.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => elegir(o.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm outline-none",
                    "hover:bg-muted focus-visible:bg-muted",
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-foreground">{o.nombre}</span>
                    <span className="text-xs text-muted-foreground">{labelFor(o.rol)}</span>
                  </span>
                  {o.id === value ? (
                    <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
