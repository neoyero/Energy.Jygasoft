"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  placeholder?: string
  /** Si se define, agrega una opción "vacía" arriba (value ""), p. ej. "Sin jefe". */
  emptyLabel?: string
  disabled?: boolean
  id?: string
  className?: string
}

interface Coords {
  left: number
  width: number
  top?: number
  bottom?: number
  maxH: number
}

/**
 * Combobox con buscador (single-select). El panel se renderiza en un PORTAL con
 * posición fija anclada al botón, así flota por encima del modal sin empujar ni
 * provocar scroll, y se voltea hacia arriba si no hay espacio abajo. Cierra al
 * elegir, con Escape o clic fuera. Sin dependencias externas.
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
  const [coords, setCoords] = useState<Coords | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
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

  const reposicionar = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const espacioAbajo = window.innerHeight - r.bottom - 8
    const espacioArriba = r.top - 8
    const arriba = espacioAbajo < 240 && espacioArriba > espacioAbajo
    setCoords({
      left: r.left,
      width: r.width,
      top: arriba ? undefined : r.bottom + 4,
      bottom: arriba ? window.innerHeight - r.top + 4 : undefined,
      maxH: Math.min(320, Math.max(160, arriba ? espacioArriba : espacioAbajo)),
    })
  }, [])

  // Al abrir: posiciona, resetea búsqueda, enfoca. Reposiciona en scroll/resize.
  useEffect(() => {
    if (!abierto) return
    reposicionar()
    setQ("")
    setActivo(0)
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    const onScroll = () => reposicionar()
    // capture:true para captar el scroll de cualquier contenedor (p. ej. el modal).
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      clearTimeout(t)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [abierto, reposicionar])

  // Cierra al hacer clic fuera del botón y del panel (portal).
  useEffect(() => {
    if (!abierto) return
    function onDoc(e: MouseEvent): void {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setAbierto(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
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
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
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

      {abierto && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                top: coords.top,
                bottom: coords.bottom,
                maxHeight: coords.maxH,
              }}
              className="z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
            >
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

              <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
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
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
