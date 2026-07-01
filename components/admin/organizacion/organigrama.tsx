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
import { ChevronDown, ChevronRight, Building2, Network, List, GripVertical, Users } from "lucide-react"

import type { OrganigramaNodo } from "@/lib/admin/queries"
import { actualizarJerarquiaUsuario } from "@/lib/admin/actions"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { cn } from "@/lib/utils"

interface NodoArbol extends OrganigramaNodo {
  hijos: NodoArbol[]
}

type Vista = "arbol" | "lista"
type ModoArbol = "persona" | "area"

/** Área para el árbol por áreas (jerarquía por padreId). */
export interface AreaOrg {
  id: string
  nombre: string
  padreId: string | null
}

interface AreaNodoArbol extends AreaOrg {
  hijos: AreaNodoArbol[]
  personas: OrganigramaNodo[]
}

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
  /** Áreas (jerarquía) para el modo "por áreas" del árbol. */
  areas?: ReadonlyArray<AreaOrg>
  /** RBAC organizacion:edit -> habilita reasignar jefe arrastrando. */
  puedeEditar?: boolean
}

/**
 * Organigrama (solo lectura). Dos vistas: "Árbol" (jerárquico de arriba hacia
 * abajo con conectores, por defecto) y "Lista" (anidada/colapsable). Ambas se
 * arman desde la línea de reporte (reportaA); raíces = nodos sin jefe (o cuyo
 * jefe no está en el conjunto, p. ej. inactivo).
 */
export function Organigrama({ nodos, areas = [], puedeEditar = false }: OrganigramaProps) {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>("arbol")
  const [modoArbol, setModoArbol] = useState<ModoArbol>("persona")
  const [overId, setOverId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const { raices, total } = useMemo(() => construirArbol(nodos), [nodos])
  const { raicesAreas, sinArea } = useMemo(() => construirArbolAreas(areas, nodos), [areas, nodos])
  // El toggle Área/Persona solo aplica en la vista árbol.
  const porArea = vista === "arbol" && modoArbol === "area"
  // Mapa id->nodo para conservar cargo/área al reasignar el jefe.
  const mapa = useMemo(() => {
    const m = new Map<string, OrganigramaNodo>()
    for (const n of nodos) m.set(n.id, n)
    return m
  }, [nodos])

  /** Reasigna el jefe (reportaA) del nodo arrastrado; null = hacerlo raíz. */
  function soltar(draggedId: string, targetId: string | null): void {
    setOverId(null)
    // Evita despachar una segunda reasignación con un snapshot (cargo/área) que
    // podría quedar stale mientras la anterior aún está en curso.
    if (!puedeEditar || pending || draggedId === targetId) return
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
          <div className="flex items-center gap-2">
            {/* Toggle Área/Persona: SOLO en la vista árbol. */}
            {vista === "arbol" ? (
              <div
                className="inline-flex rounded-lg border border-stone-200 p-0.5 dark:border-border"
                role="group"
                aria-label="Agrupar el árbol por persona o por área"
              >
                <BotonVista activo={modoArbol === "persona"} onClick={() => setModoArbol("persona")} label="Por persona">
                  <Users className="size-4" aria-hidden /> Persona
                </BotonVista>
                <BotonVista activo={modoArbol === "area"} onClick={() => setModoArbol("area")} label="Por área">
                  <Building2 className="size-4" aria-hidden /> Área
                </BotonVista>
              </div>
            ) : null}

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
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* Zona para soltar y convertir en raíz (quitar jefe). Solo en modo persona. */}
        {puedeEditar && !porArea ? <ZonaRaiz /> : null}

        {vista === "arbol" ? (
          porArea ? (
            <OrganigramaAreas raices={raicesAreas} sinArea={sinArea} />
          ) : (
            <OrganigramaArbol raices={raices} />
          )
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
  // Deshabilita el arrastre/soltar mientras hay una reasignación en curso.
  const editable = (dnd?.puedeEditar ?? false) && !(dnd?.pending ?? false)
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

/* ── Vista ÁRBOL POR ÁREAS (áreas anidadas con personas dentro) ──────────── */

function OrganigramaAreas({
  raices,
  sinArea,
}: {
  raices: AreaNodoArbol[]
  sinArea: OrganigramaNodo[]
}) {
  if (raices.length === 0 && sinArea.length === 0) {
    return (
      <EmptyState
        title="Sin áreas"
        description="Crea áreas (en Áreas) y asigna a cada usuario su área (en Usuarios)."
      />
    )
  }
  return (
    <div className="overflow-x-auto pb-4">
      <style>{TREE_CSS}</style>
      <div className="org-tree min-w-fit text-stone-300 dark:text-border">
        <ul>
          {raices.map((a) => (
            <AreaOrgNodo key={a.id} nodo={a} />
          ))}
          {/* Personas sin área asignada: su propio recuadro. */}
          {sinArea.length > 0 ? (
            <li>
              <AreaCaja nombre="Sin área" personas={sinArea} dashed />
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function AreaOrgNodo({ nodo }: { nodo: AreaNodoArbol }) {
  return (
    <li>
      <AreaCaja nombre={nodo.nombre} personas={nodo.personas} />
      {nodo.hijos.length > 0 ? (
        <ul>
          {nodo.hijos.map((h) => (
            <AreaOrgNodo key={h.id} nodo={h} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * Recuadro (tag) de un área con SUS PERSONAS dentro (lista compacta). Los nombres
 * largos se truncan y muestran el nombre completo + cargo en un tooltip (title).
 */
function AreaCaja({
  nombre,
  personas,
  dashed = false,
}: {
  nombre: string
  personas: OrganigramaNodo[]
  dashed?: boolean
}) {
  return (
    <div
      className={cn(
        "org-node inline-flex w-52 flex-col gap-1.5 rounded-xl border px-3 py-2.5 shadow-sm",
        dashed
          ? "border-dashed border-border bg-muted/30"
          : "border-brand/30 bg-brand/5 dark:border-primary/40 dark:bg-primary/10",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          title={nombre}
          className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight text-brand dark:text-foreground"
        >
          <Building2 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{nombre}</span>
        </span>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 text-[10px] font-medium text-muted-foreground">
          {personas.length}
        </span>
      </div>

      {personas.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {personas.map((p) => {
            const cargo = p.cargo ?? labelFor(p.rol)
            return (
              <li
                key={p.id}
                title={cargo ? `${p.nombre} · ${cargo}` : p.nombre}
                className="truncate rounded-md bg-card/80 px-2 py-1 text-left text-xs text-foreground"
              >
                <span className="font-medium">{p.nombre}</span>
                {cargo ? <span className="text-muted-foreground"> · {cargo}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <span className="text-[11px] italic text-muted-foreground">Sin personas</span>
      )}
    </div>
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

/** Arma el árbol de ÁREAS (por padreId) con las personas de cada área dentro. */
function construirArbolAreas(
  areas: ReadonlyArray<AreaOrg>,
  personas: ReadonlyArray<OrganigramaNodo>,
): { raicesAreas: AreaNodoArbol[]; sinArea: OrganigramaNodo[] } {
  const mapa = new Map<string, AreaNodoArbol>()
  for (const a of areas) mapa.set(a.id, { ...a, hijos: [], personas: [] })

  const raicesAreas: AreaNodoArbol[] = []
  for (const a of mapa.values()) {
    const padre = a.padreId ? mapa.get(a.padreId) : null
    if (padre) padre.hijos.push(a)
    else raicesAreas.push(a)
  }

  const sinArea: OrganigramaNodo[] = []
  for (const p of personas) {
    const area = p.areaId ? mapa.get(p.areaId) : null
    if (area) area.personas.push(p)
    else sinArea.push(p)
  }

  const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
    a.nombre.localeCompare(b.nombre, "es")
  const ordenar = (lista: AreaNodoArbol[]) => {
    lista.sort(porNombre)
    lista.forEach((x) => {
      x.personas.sort(porNombre)
      ordenar(x.hijos)
    })
  }
  ordenar(raicesAreas)
  sinArea.sort(porNombre)

  return { raicesAreas, sinArea }
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
