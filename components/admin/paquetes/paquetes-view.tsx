"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"

import type { PaqueteRow, PaquetesFiltros, PaqueteSegmento } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/admin/ui/modal"
import { PaquetesTable } from "@/components/admin/paquetes/paquetes-table"
import { PaqueteForm } from "@/components/admin/paquetes/paquete-form"

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const SEGMENTOS: ReadonlyArray<{ value: PaqueteSegmento; label: string }> = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
]

export interface PaquetesViewProps {
  puedeEditar: boolean
}

/**
 * Contenedor del listado de paquetes: filtros (segmento / solo activos /
 * búsqueda con debounce), alta y edición de cabecera en modal, y la tabla
 * (paginación server). Al crear, navega al detalle para agregar líneas.
 */
export function PaquetesView({ puedeEditar }: PaquetesViewProps) {
  const router = useRouter()
  const [segmento, setSegmento] = useState<PaqueteSegmento | "">("")
  const [soloActivos, setSoloActivos] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [busquedaEf, setBusquedaEf] = useState("")
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<PaqueteRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaEf(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const filtros: PaquetesFiltros = useMemo(
    () => ({
      segmento: segmento || undefined,
      soloActivos: soloActivos || undefined,
      busqueda: busquedaEf.trim() || undefined,
    }),
    [segmento, soloActivos, busquedaEf],
  )

  function cerrar(): void {
    setCreando(false)
    setEditando(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="f-segmento" className="block text-xs font-medium text-muted-foreground">
              Segmento
            </label>
            <select
              id="f-segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as PaqueteSegmento | "")}
              className={SELECT_CLASS}
            >
              <option value="">Todos</option>
              {SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="f-busqueda" className="block text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="f-busqueda"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o clave…"
                className="w-56 pl-8"
              />
            </div>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Solo activos
          </label>
        </div>

        {puedeEditar ? (
          <Button type="button" size="sm" onClick={() => { setEditando(null); setCreando(true) }}>
            <Plus className="size-4" aria-hidden /> Nuevo paquete
          </Button>
        ) : null}
      </div>

      <PaquetesTable
        filtros={filtros}
        puedeEditar={puedeEditar}
        onEdit={(p) => { setCreando(false); setEditando(p) }}
        reloadToken={reloadToken}
      />

      {puedeEditar ? (
        <Modal
          open={creando || editando !== null}
          onOpenChange={(abierto) => { if (!abierto) cerrar() }}
          title={editando ? "Editar paquete" : "Nuevo paquete"}
          description={
            editando
              ? "Modifica los datos del paquete. Las líneas se editan en su detalle."
              : "Crea el paquete; luego agrega sus líneas en el detalle."
          }
          size="2xl"
          dismissable={!saving}
        >
          <PaqueteForm
            key={editando?.id ?? "nuevo"}
            modo={editando ? "editar" : "crear"}
            paquete={editando ?? undefined}
            onSuccess={(id) => {
              const irADetalle = !editando && id
              cerrar()
              setReloadToken((n) => n + 1)
              if (irADetalle) router.push(`/je-admin/paquetes/${id}`)
            }}
            onCancel={cerrar}
            onSavingChange={setSaving}
          />
        </Modal>
      ) : null}
    </div>
  )
}
