"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  ChevronRight,
  ListTree,
  Rows3,
  Users,
} from "lucide-react"

import type { AreaRow, AreasFiltros, AreasPage, AreaArbolRow } from "@/lib/admin/queries"
import { fetchAreas, fetchAreasArbol, toggleAreaActiva, eliminarArea } from "@/lib/admin/actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/admin/ui/data-table"
import { AreaForm, type AreaFormArea } from "@/components/admin/areas/area-form"

const PAGE_SIZE = 15

export interface AreasViewProps {
  puedeEditar: boolean
  /** Usuarios para el selector de líder en el formulario. */
  usuarios: ReadonlyArray<{ id: string; nombre: string }>
}

type Modo = "arbol" | "lista"

interface NodoArea extends AreaArbolRow {
  hijos: NodoArea[]
  nivel: number
}

/** Arma el árbol a partir de la lista plana (padreId). Huérfanos → raíz. */
function construirArbol(rows: ReadonlyArray<AreaArbolRow>): NodoArea[] {
  const byId = new Map<string, NodoArea>()
  for (const r of rows) byId.set(r.id, { ...r, hijos: [], nivel: 0 })
  const roots: NodoArea[] = []
  for (const n of byId.values()) {
    const padre = n.padreId ? byId.get(n.padreId) : undefined
    if (padre) padre.hijos.push(n)
    else roots.push(n)
  }
  const fijarNivel = (n: NodoArea, nivel: number): void => {
    n.nivel = nivel
    n.hijos.forEach((h) => fijarNivel(h, nivel + 1))
  }
  roots.forEach((r) => fijarNivel(r, 0))
  return roots
}

/** Listado de áreas/departamentos: vista en árbol (jerarquía) o lista plana. */
export function AreasView({ puedeEditar, usuarios }: AreasViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modo, setModo] = useState<Modo>("arbol")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AreasPage>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [arbol, setArbol] = useState<AreaArbolRow[]>([])
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<AreaFormArea | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: AreasFiltros = useMemo(
    () => ({ busqueda: busquedaEf.trim() || undefined, soloActivas: soloActivas || undefined }),
    [busquedaEf, soloActivas],
  )
  const filtrosKey = JSON.stringify(filtros)

  const fetchPage = useCallback(
    (p: number): Promise<AreasPage> =>
      fetchAreas({ filtros, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrosKey],
  )

  useEffect(() => {
    setPage(1)
  }, [filtrosKey])

  // Árbol: se carga siempre (alimenta la vista jerárquica y el selector de padre).
  useEffect(() => {
    let stale = false
    fetchAreasArbol()
      .then((rows) => {
        if (!stale) setArbol(rows)
      })
      .catch(() => {})
    return () => {
      stale = true
    }
  }, [reloadToken])

  // Lista paginada (solo se usa en modo lista).
  useEffect(() => {
    let stale = false
    setLoading(true)
    fetchPage(page)
      .then((res) => {
        if (!stale) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [fetchPage, page, reloadToken])

  const arbolFiltrado = useMemo(
    () => (soloActivas ? arbol.filter((a) => a.activa) : arbol),
    [arbol, soloActivas],
  )
  const roots = useMemo(() => construirArbol(arbolFiltrado), [arbolFiltrado])
  const areasParaForm = useMemo(() => arbol.map((a) => ({ id: a.id, nombre: a.nombre })), [arbol])

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }
  function trasGuardar(): void {
    cerrar()
    setReloadToken((n) => n + 1)
  }
  function accion(fn: () => Promise<unknown>): void {
    startTransition(async () => {
      await fn()
      setReloadToken((n) => n + 1)
      router.refresh()
    })
  }

  const estadoBadge = (activa: boolean) =>
    activa ? (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        Activa
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
        Inactiva
      </span>
    )

  const columns: ReadonlyArray<DataTableColumn<AreaRow>> = [
    {
      id: "nombre",
      header: "Área",
      accessor: (r) => r.nombre,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
          {r.descripcion ? (
            <span className="text-xs text-stone-500 dark:text-muted-foreground">{r.descripcion}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "padre",
      header: "Área padre",
      accessor: (r) => r.padreNombre ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-stone-600 dark:text-muted-foreground">{r.padreNombre ?? "—"}</span>
      ),
    },
    {
      id: "lider",
      header: "Líder",
      accessor: (r) => r.liderNombre ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-stone-600 dark:text-muted-foreground">{r.liderNombre ?? "—"}</span>
      ),
    },
    {
      id: "miembros",
      header: "Miembros",
      accessor: (r) => r.miembros,
      align: "end",
      hideOnMobile: true,
      render: (r) => (
        <span className="tabular-nums text-stone-600 dark:text-muted-foreground">{r.miembros}</span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessor: (r) => (r.activa ? 1 : 0),
      render: (r) => estadoBadge(r.activa),
    },
  ]

  const rowActions: ReadonlyArray<DataTableRowAction<AreaRow>> | undefined = puedeEditar
    ? [
        { label: "Editar", icon: <Pencil className="size-4" />, onSelect: (r) => setEditando(r) },
        {
          label: "Desactivar",
          icon: <PowerOff className="size-4" />,
          onSelect: (r) => accion(() => toggleAreaActiva(r.id, false)),
          hidden: (r) => !r.activa,
        },
        {
          label: "Activar",
          icon: <Power className="size-4" />,
          onSelect: (r) => accion(() => toggleAreaActiva(r.id, true)),
          hidden: (r) => r.activa,
        },
        {
          label: "Eliminar",
          icon: <Trash2 className="size-4" />,
          destructive: true,
          onSelect: (r) => accion(() => eliminarArea(r.id)),
          confirm: {
            title: "Eliminar área",
            description: (r) => (
              <>
                Se eliminará <strong>{r.nombre}</strong>. Sus subáreas quedarán como raíz y los miembros
                sin área asignada. ¿Continuar?
              </>
            ),
            confirmLabel: "Eliminar",
          },
        },
      ]
    : undefined

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Toggle de vista */}
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setModo("arbol")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                modo === "arbol" ? "bg-brand-green text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListTree className="size-4" /> Árbol
            </button>
            <button
              type="button"
              onClick={() => setModo("lista")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                modo === "lista" ? "bg-brand-green text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Rows3 className="size-4" /> Lista
            </button>
          </div>

          {modo === "lista" ? (
            <div className="space-y-1.5">
              <label htmlFor="a-busqueda" className="block text-xs font-medium text-muted-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="a-busqueda"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre…"
                  className="w-56 pl-8"
                />
              </div>
            </div>
          ) : null}

          <label className="flex h-9 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Solo activas
          </label>
        </div>

        {puedeEditar ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditando(null)
              setCreando(true)
            }}
          >
            <Plus className="size-4" aria-hidden /> Nueva área
          </Button>
        ) : null}
      </div>

      {modo === "arbol" ? (
        <div className="rounded-xl border border-border bg-card">
          {roots.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin áreas. Crea la primera área/departamento.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {roots.map((n) => (
                <AreaNodo
                  key={n.id}
                  nodo={n}
                  puedeEditar={puedeEditar}
                  onEditar={(a) => setEditando(a)}
                  onToggle={(a) => accion(() => toggleAreaActiva(a.id, !a.activa))}
                  onEliminar={(a) => accion(() => eliminarArea(a.id))}
                  estadoBadge={estadoBadge}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <DataTable<AreaRow>
          data={data.rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={puedeEditar ? (r) => setEditando(r) : undefined}
          rowActions={rowActions}
          loading={loading}
          mobileCard={(r) => (
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-medium text-stone-800 dark:text-foreground">{r.nombre}</span>
                <span className="text-xs text-stone-600 dark:text-muted-foreground">
                  {r.padreNombre ? `${r.padreNombre} · ` : ""}
                  {r.liderNombre ?? "Sin líder"} · {r.miembros} miembro{r.miembros === 1 ? "" : "s"}
                </span>
              </div>
              {estadoBadge(r.activa)}
            </div>
          )}
          pageControl={{ page, pageCount, total: data.total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          empty={{ title: "Sin áreas", description: "Crea la primera área/departamento." }}
        />
      )}

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => {
            if (!abierto) cerrar()
          }}
          title={editando ? "Editar área" : "Nueva área"}
          size="lg"
          dismissable={!saving}
        >
          <AreaForm
            key={editando?.id ?? "nueva"}
            modo={editando ? "editar" : "crear"}
            area={editando ?? undefined}
            usuarios={usuarios}
            areas={areasParaForm}
            onSuccess={trasGuardar}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}

/* ── Nodo del árbol (recursivo) ───────────────────────────────────────────── */

function AreaNodo({
  nodo,
  puedeEditar,
  onEditar,
  onToggle,
  onEliminar,
  estadoBadge,
}: {
  nodo: NodoArea
  puedeEditar: boolean
  onEditar: (a: AreaFormArea) => void
  onToggle: (a: AreaArbolRow) => void
  onEliminar: (a: AreaArbolRow) => void
  estadoBadge: (activa: boolean) => React.ReactNode
}) {
  const [abierto, setAbierto] = useState(true)
  const tieneHijos = nodo.hijos.length > 0

  const areaForm: AreaFormArea = {
    id: nodo.id,
    nombre: nodo.nombre,
    descripcion: nodo.descripcion,
    liderId: nodo.liderId,
    padreId: nodo.padreId,
    activa: nodo.activa,
  }

  return (
    <li>
      <div
        className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40"
        style={{ paddingLeft: `${0.75 + nodo.nivel * 1.25}rem` }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform",
            !tieneHijos && "invisible",
            abierto && "rotate-90",
          )}
          aria-label={abierto ? "Colapsar" : "Expandir"}
        >
          <ChevronRight className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium text-stone-800 dark:text-foreground">{nodo.nombre}</span>
            {estadoBadge(nodo.activa)}
            {tieneHijos ? (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
                {nodo.hijos.length} subárea{nodo.hijos.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>Líder: {nodo.liderNombre ?? "—"}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden /> {nodo.miembros}
            </span>
          </div>
        </div>

        {puedeEditar ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => onEditar(areaForm)} title="Editar">
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onToggle(nodo)}
              title={nodo.activa ? "Desactivar" : "Activar"}
            >
              {nodo.activa ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onEliminar(nodo)}
              title="Eliminar"
              className="text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {tieneHijos && abierto ? (
        <ul className="divide-y divide-border border-t border-border">
          {nodo.hijos.map((h) => (
            <AreaNodo
              key={h.id}
              nodo={h}
              puedeEditar={puedeEditar}
              onEditar={onEditar}
              onToggle={onToggle}
              onEliminar={onEliminar}
              estadoBadge={estadoBadge}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
