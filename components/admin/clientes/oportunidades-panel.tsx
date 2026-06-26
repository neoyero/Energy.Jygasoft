"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"

import { crearOportunidadDeCliente } from "@/lib/admin/actions"
import type { ClienteOportunidadRow } from "@/lib/admin/queries"
import { oportunidadEtapa } from "@/db/schema"
import { formatMXN, fmtFechaRel } from "@/lib/admin/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"
import { cn } from "@/lib/utils"

export interface OportunidadesPanelProps {
  clienteId: string
  oportunidades: ReadonlyArray<ClienteOportunidadRow>
  /** RBAC oportunidades:edit -> habilita el alta de oportunidades. */
  puedeCrear: boolean
}

interface OportunidadFormState {
  nombre: string
  etapa: string
  montoEstimado: string
  capacidadKwp: string
  fechaCierreEstimada: string
}

const VACIO: OportunidadFormState = {
  nombre: "",
  etapa: "calificacion",
  montoEstimado: "",
  capacidadKwp: "",
  fechaCierreEstimada: "",
}

/** "" -> null; en caso contrario parsea a number (NaN -> null). */
function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "" -> null para columnas de texto/fecha opcionales. */
function strOrNull(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Panel de oportunidades de un cliente. Lista las oportunidades en pipeline con
 * link al detalle y, si el rol puede crear, abre un form plegable para dar de
 * alta una nueva oportunidad via server action dentro de useTransition. Refresca
 * la ruta al éxito.
 */
export function OportunidadesPanel({
  clienteId,
  oportunidades,
  puedeCrear,
}: OportunidadesPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<OportunidadFormState>(VACIO)

  function set<K extends keyof OportunidadFormState>(
    key: K,
    value: OportunidadFormState[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function abrir(): void {
    setError(null)
    setForm(VACIO)
    setAbierto(true)
  }

  function cerrar(): void {
    setAbierto(false)
    setForm(VACIO)
    setError(null)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await crearOportunidadDeCliente(clienteId, {
        nombre: form.nombre.trim(),
        etapa: form.etapa as (typeof oportunidadEtapa.enumValues)[number],
        montoEstimado: numOrNull(form.montoEstimado),
        capacidadKwp: numOrNull(form.capacidadKwp),
        fechaCierreEstimada: strOrNull(form.fechaCierreEstimada),
      })

      if (!res.ok) {
        setError(res.error)
        return
      }

      cerrar()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeCrear ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {oportunidades.length} oportunidad
            {oportunidades.length === 1 ? "" : "es"}
          </p>
          {!abierto ? (
            <Button type="button" size="sm" onClick={abrir}>
              <Plus className="size-4" aria-hidden />
              Nueva oportunidad
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Form de alta */}
      {puedeCrear && abierto ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="oportunidad-nombre">Nombre</Label>
            <Input
              id="oportunidad-nombre"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              disabled={pending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oportunidad-etapa">Etapa</Label>
            <select
              id="oportunidad-etapa"
              value={form.etapa}
              onChange={(e) => set("etapa", e.target.value)}
              disabled={pending}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
                "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {oportunidadEtapa.enumValues.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {labelFor(etapa)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oportunidad-monto">Monto estimado (MXN)</Label>
            <Input
              id="oportunidad-monto"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.montoEstimado}
              onChange={(e) => set("montoEstimado", e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oportunidad-kwp">Capacidad (kWp)</Label>
            <Input
              id="oportunidad-kwp"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.capacidadKwp}
              onChange={(e) => set("capacidadKwp", e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oportunidad-cierre">Cierre estimado</Label>
            <Input
              id="oportunidad-cierre"
              type="date"
              value={form.fechaCierreEstimada}
              onChange={(e) => set("fechaCierreEstimada", e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Crear oportunidad"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={cerrar}
            >
              <X className="size-4" aria-hidden />
              Cancelar
            </Button>
            {error ? (
              <span className="text-sm text-destructive">{error}</span>
            ) : null}
          </div>
        </form>
      ) : null}

      {/* Errores fuera del form */}
      {error && !abierto ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {/* Lista de oportunidades */}
      {oportunidades.length === 0 ? (
        <EmptyState
          title="Sin oportunidades"
          description="Este cliente no tiene oportunidades en pipeline."
          size="sm"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                {["Nombre", "Etapa", "Monto", "Creada"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {oportunidades.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-stone-700 dark:text-foreground">
                    <a
                      href={`/je-admin/oportunidades/${o.id}`}
                      className="font-medium text-brand hover:underline dark:text-foreground"
                    >
                      {o.nombre}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-stone-700 dark:text-foreground">
                    <StatusBadge value={o.etapa} withDot={false} />
                  </td>
                  <td className="px-4 py-3 text-stone-700 dark:text-foreground">
                    {formatMXN(o.montoEstimado)}
                  </td>
                  <td className="px-4 py-3 text-stone-700 dark:text-foreground">
                    {fmtFechaRel(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
