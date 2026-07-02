"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ComboOption {
  value: string
  label: string
  /** Texto secundario opcional (se muestra tenue y también se busca). */
  hint?: string
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<ComboOption>
  /** Texto cuando no hay selección. */
  placeholder?: string
  /** Si se define, agrega una opción "vacía" arriba (value ""), p. ej. "Sin jefe". */
  emptyLabel?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * Combobox con buscador (single-select). Botón que muestra la selección; al
 * abrir, un panel con input de búsqueda + lista filtrada. Cierra al elegir, con
 * Escape o al hacer clic fuera. Sin dependencias externas.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  emptyLabel,
  disabled = false,
  id,
  className,
}: ComboboxProps) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState("")
  const [activo, setActivo] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const seleccion = options.find((o) => o.value === value)
  const textoBoton = value === "" ? (emptyLabel ?? placeholder) : (seleccion?.label ?? placeholder)

  const lista = useMemo<ComboOption[]>(() => {
    const base: ComboOption[] = emptyLabel ? [{ value: "", label: emptyLabel }] : []
    const term = q.trim().toLowerCase()
    const filtradas = term
      ? options.filter(
          (o) => o.label.toLowerCase().includes(term) || (o.hint ?? "").toLowerCase().includes(term),
        )
      : options.slice()
    return [...base, ...filtradas]
  }, [options, q, emptyLabel])

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [abierto])

  // Enfoca el buscador al abrir.
  useEffect(() => {
    if (abierto) {
      setQ("")
      setActivo(0)
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
  }, [abierto])

  function elegir(v: string): void {
    onChange(v)
    setAbierto(false)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      setAbierto(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, lista.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const op = lista[activo]
      if (op) elegir(op.value)
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-sm outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className={cn("truncate", value === "" && !emptyLabel && "text-muted-foreground")}>
          {textoBoton}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {abierto ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setActivo(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar…"
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("")
                  inputRef.current?.focus()
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Limpiar"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {lista.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</li>
            ) : (
              lista.map((o, i) => (
                <li key={o.value || "__none__"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => elegir(o.value)}
                    onMouseEnter={() => setActivo(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                      i === activo ? "bg-muted" : "",
                    )}
                  >
                    <Check className={cn("size-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">
                      {o.label}
                      {o.hint ? <span className="ml-1 text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
