"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Building2, Network, List, GripVertical } from "lucide-react"

import type { OrganigramaNodo } from "@/lib/admin/queries"
import { actualizarJerarquiaUsuario } from "@/lib/admin/actions"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

interface NodoArbol extends OrganigramaNodo {
  hijos: NodoArbol[]
}

type Vista = "arbol" | "lista"

/** Contexto de arrastre del organigrama (evita prop-drilling en el árbol). */
interface OrgDnd {
  puedeEditar: boolean
  overId: string | null
  pending: boolean
  setOver: (id: string | null) => void
  soltar: (draggedId: string, targetId: string | null) => void
}
const OrgDndCtx = createContext<OrgDnd | null>(null)

export interface OrganigramaProps {
  nodos: ReadonlyArray<OrganigramaNodo>
  /** RBAC organizacion:edit -> habilita reasignar jefe arrastrando. */
  puedeEditar?: boolean
}

/**
 * Organigrama (solo lectura). Dos vistas: "Árbol" (jerárquico de arriba hacia
 * abajo con conectores, por defecto) y "Lista" (anidada/colapsable). Ambas se
 * arman desde la línea de reporte (reportaA); raíces = nodos sin jefe (o cuyo
 * jefe no está en el conjunto, p. ej. inactivo).
 */
export function Organigrama({ nodos, puedeEditar = false }: OrganigramaProps) {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>("arbol")
  const [overId, setOverId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const { raices, total } = useMemo(() => construirArbol(nodos), [nodos])
  // Mapa id->nodo para conservar cargo/área al reasignar el jefe.
  const mapa = useMemo(() => {
    const m = new Map<string, OrganigramaNodo>()
    for (const n of nodos) m.set(n.id, n)
    return m
  }, [nodos])

  /** Reasigna el jefe (reportaA) del nodo arrastrado; null = hacerlo raíz. */
  function soltar(draggedId: string, targetId: string | null): void {
    setOverId(null)
    if (!puedeEditar || draggedId === targetId) return
    const n = mapa.get(draggedId)
    if (!n) return
    if (n.reportaA === targetId) return // sin cambios
    setError(null)
    startTransition(async () => {
      const res = await actualizarJerarquiaUsuario(draggedId, {
        reportaA: targetId,
        cargo: n.cargo,
        areaId: n.areaId,
      })
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  const dnd: OrgDnd = { puedeEditar, overId, pending, setOver: setOverId, soltar }

  if (total === 0) {
    return (
      <EmptyState
        title="Organigrama vacío"
        description="Asigna jefe y cargo a los usuarios (en Usuarios) para construir la estructura."
      />
    )
  }

  return (
    <OrgDndCtx.Provider value={dnd}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          {puedeEditar ? (
            <p className="text-xs text-muted-foreground">
              Arrastra una tarjeta sobre otra para reasignar su jefe
              {pending ? " · guardando…" : ""}.
            </p>
          ) : (
            <span />
          )}
          <div
            className="inline-flex rounded-lg border border-stone-200 p-0.5 dark:border-border"
            role="group"
            aria-label="Cambiar vista del organigrama"
          >
            <BotonVista activo={vista === "arbol"} onClick={() => setVista("arbol")} label="Árbol">
              <Network className="size-4" aria-hidden /> Árbol
            </BotonVista>
            <BotonVista activo={vista === "lista"} onClick={() => setVista("lista")} label="Lista">
              <List className="size-4" aria-hidden /> Lista
            </BotonVista>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* Zona para soltar y convertir en raíz (quitar jefe). */}
        {puedeEditar ? <ZonaRaiz /> : null}

        {vista === "arbol" ? (
          <OrganigramaArbol raices={raices} />
        ) : (
          <div className="flex flex-col gap-2">
            {raices.map((n) => (
              <NodoLista key={n.id} nodo={n} nivel={0} />
            ))}
          </div>
        )}
      </div>
    </OrgDndCtx.Provider>
  )
}

/** Zona de drop para quitar el jefe (dejar el nodo como raíz del organigrama). */
function ZonaRaiz() {
  const dnd = useContext(OrgDndCtx)
  const [over, setOver] = useState(false)
  if (!dnd) return null
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData("text/plain")
        if (id) dnd.soltar(id, null)
      }}
      className={cn(
        "rounded-lg border border-dashed px-3 py-2 text-center text-xs transition-colors",
        over
          ? "border-brand bg-brand/5 text-brand dark:border-primary"
          : "border-border text-muted-foreground",
      )}
    >
      Soltar aquí para quitar el jefe (dejar como raíz)
    </div>
  )
}

/* ── Vista ÁRBOL (top-down con conectores CSS) ───────────────────────────── */

function OrganigramaArbol({ raices }: { raices: NodoArbol[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      {/* CSS de los conectores: bordes con currentColor (color tenue heredado). */}
      <style>{TREE_CSS}</style>
      <div className="org-tree min-w-fit text-stone-300 dark:text-border">
        <ul>
          {raices.map((n) => (
            <ArbolNodo key={n.id} nodo={n} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function ArbolNodo({ nodo }: { nodo: NodoArbol }) {
  const tieneHijos = nodo.hijos.length > 0
  const dnd = useContext(OrgDndCtx)
  const editable = dnd?.puedeEditar ?? false
  const isOver = dnd?.overId === nodo.id

  function onDragStart(e: DragEvent<HTMLDivElement>): void {
    e.dataTransfer.setData("text/plain", nodo.id)
    e.dataTransfer.effectAllowed = "move"
  }
  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (id) dnd?.soltar(id, nodo.id)
  }

  return (
    <li>
      <div
        draggable={editable}
        onDragStart={editable ? onDragStart : undefined}
        onDragOver={
          editable
            ? (e) => {
                e.preventDefault()
                dnd?.setOver(nodo.id)
              }
            : undefined
        }
        onDragLeave={
          editable
            ? (e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) dnd?.setOver(null)
              }
            : undefined
        }
        onDrop={editable ? onDrop : undefined}
        className={cn(
          "org-node relative inline-flex w-44 flex-col items-center gap-1 rounded-xl border bg-card px-3 py-2.5 text-center shadow-sm transition-colors",
          editable && "cursor-grab active:cursor-grabbing",
          isOver ? "border-brand ring-2 ring-brand/40 dark:border-primary" : "border-border",
        )}
      >
        {editable ? (
          <GripVertical
            className="absolute right-1 top-1 size-3.5 text-stone-300 dark:text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <span className="grid size-9 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-muted dark:text-foreground">
          {nodo.nombre.charAt(0).toUpperCase()}
        </span>
        <span className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
          {nodo.nombre}
        </span>
        <span className="text-xs text-muted-foreground">{nodo.cargo ?? labelFor(nodo.rol)}</span>
        {nodo.areaNombre ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Building2 className="size-3" aria-hidden /> {nodo.areaNombre}
          </span>
        ) : null}
      </div>

      {tieneHijos ? (
        <ul>
          {nodo.hijos.map((h) => (
            <ArbolNodo key={h.id} nodo={h} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/* ── Vista LISTA (anidada / colapsable) ──────────────────────────────────── */

function NodoLista({ nodo, nivel }: { nodo: NodoArbol; nivel: number }) {
  const [abierto, setAbierto] = useState(true)
  const tieneHijos = nodo.hijos.length > 0

  return (
    <div className={cn(nivel > 0 && "ml-5 border-l border-border pl-4")}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? "Colapsar" : "Expandir"}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block size-6 shrink-0" aria-hidden />
        )}

        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-muted dark:text-foreground">
          {nodo.nombre.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{nodo.nombre}</span>
            <StatusBadge value={nodo.rol} tone="neutral" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{nodo.cargo ?? labelFor(nodo.rol)}</span>
            {nodo.areaNombre ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" aria-hidden /> {nodo.areaNombre}
              </span>
            ) : null}
            {tieneHijos ? <span>{nodo.hijos.length} a cargo</span> : null}
          </div>
        </div>
      </div>

      {tieneHijos && abierto ? (
        <div className="mt-2 flex flex-col gap-2">
          {nodo.hijos.map((h) => (
            <NodoLista key={h.id} nodo={h} nivel={nivel + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function BotonVista({
  activo,
  onClick,
  label,
  children,
}: {
  activo: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        activo
          ? "bg-brand text-white dark:bg-primary dark:text-primary-foreground"
          : "text-stone-500 hover:bg-stone-100 dark:text-muted-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

/** Arma el bosque (puede haber varias raíces) desde la lista plana. */
function construirArbol(nodos: ReadonlyArray<OrganigramaNodo>): {
  raices: NodoArbol[]
  total: number
} {
  const mapa = new Map<string, NodoArbol>()
  for (const n of nodos) mapa.set(n.id, { ...n, hijos: [] })

  const raices: NodoArbol[] = []
  for (const n of mapa.values()) {
    const padre = n.reportaA ? mapa.get(n.reportaA) : null
    if (padre) padre.hijos.push(n)
    else raices.push(n) // sin jefe o jefe fuera del conjunto (inactivo)
  }

  const ordenar = (lista: NodoArbol[]) => {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    lista.forEach((x) => ordenar(x.hijos))
  }
  ordenar(raices)

  return { raices, total: mapa.size }
}

/**
 * Conectores del árbol con bordes que usan currentColor (color tenue heredado
 * del contenedor). Las tarjetas (.org-node) fijan sus propios colores, así que
 * no heredan el tono de los conectores. Patrón clásico de organigrama en CSS.
 */
const TREE_CSS = `
.org-tree ul { display: flex; justify-content: center; padding-top: 22px; position: relative; }
.org-tree li { list-style: none; position: relative; padding: 22px 10px 0; display: flex; flex-direction: column; align-items: center; }
.org-tree li::before, .org-tree li::after {
  content: ''; position: absolute; top: 0; right: 50%;
  border-top: 2px solid; width: 50%; height: 22px;
}
.org-tree li::after { right: auto; left: 50%; border-left: 2px solid; }
.org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
.org-tree li:only-child { padding-top: 22px; }
.org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
.org-tree li:last-child::before { border-right: 2px solid; border-radius: 0 6px 0 0; }
.org-tree li:first-child::after { border-radius: 6px 0 0 0; }
.org-tree ul ul::before {
  content: ''; position: absolute; top: 0; left: 50%;
  border-left: 2px solid; width: 0; height: 22px;
}
/* Nivel raíz: sin línea hacia arriba (las raíces no tienen jefe). */
.org-tree > ul { padding-top: 0; }
.org-tree > ul > li::before, .org-tree > ul > li::after { display: none; }
.org-tree > ul > li { padding-top: 0; }
`
