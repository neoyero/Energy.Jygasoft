"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PackagePlus, Sparkles, AlertTriangle, Check } from "lucide-react"

import {
  sugerirPaquetesParaCotizacion,
  aplicarPaqueteACotizacion,
  type SugerenciaPaquetes,
} from "@/lib/admin/actions"
import type { PaqueteOpcion } from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/admin/ui/card"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const SEGMENTO_LABEL: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  industrial: "Industrial",
}

export interface CotizacionPaquetePanelProps {
  cotizacionId: string
  capacidadKwp: number | null
  puedeEditar: boolean
}

function fmtMxn(n: number): string {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
}

/**
 * Panel del paso Sistema para armar la cotización desde un PAQUETE. "Sugerir
 * paquete" usa el mejor ajuste (capacidad + segmento del cliente); "Aplicar"
 * copia las líneas a las partidas SIN tocar el paso Sistema. Avisa si el paquete
 * no cubre la capacidad o tiene precios desactualizados.
 */
export function CotizacionPaquetePanel({ cotizacionId, capacidadKwp, puedeEditar }: CotizacionPaquetePanelProps) {
  const router = useRouter()
  const [cargando, startCarga] = useTransition()
  const [aplicando, startAplica] = useTransition()
  const [sug, setSug] = useState<SugerenciaPaquetes | null>(null)
  const [selId, setSelId] = useState<string>("")
  const [reemplazar, setReemplazar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  if (!puedeEditar) return null

  function sugerir(): void {
    setError(null)
    setOkMsg(null)
    startCarga(async () => {
      const res = await sugerirPaquetesParaCotizacion(cotizacionId)
      if (!res.ok) {
        setError(res.error ?? "No se pudo sugerir un paquete.")
        return
      }
      setSug(res)
      setSelId(res.mejor?.id ?? res.candidatos?.[0]?.id ?? "")
    })
  }

  function aplicar(): void {
    if (!selId) return
    setError(null)
    setOkMsg(null)
    startAplica(async () => {
      const res = await aplicarPaqueteACotizacion({
        cotizacionId,
        paqueteId: selId,
        modo: reemplazar ? "reemplazar" : "solo_vacio",
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOkMsg("Paquete aplicado a las partidas.")
      router.refresh()
    })
  }

  const candidatos = sug?.candidatos ?? []
  const seleccionado: PaqueteOpcion | undefined = candidatos.find((c) => c.id === selId)
  const objetivo = sug?.capacidadKwp ?? capacidadKwp
  const noCubre =
    seleccionado != null &&
    objetivo != null &&
    (seleccionado.capacidadKwp ?? 0) < objetivo

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <PackagePlus className="size-4 text-muted-foreground" aria-hidden />
            Armar desde un paquete
          </span>
          <Button type="button" size="sm" variant="outline" onClick={sugerir} disabled={cargando}>
            <Sparkles className="size-4" aria-hidden />
            {cargando ? "Buscando…" : "Sugerir paquete"}
          </Button>
        </div>

        {sug ? (
          sug.candidatos && sug.candidatos.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Segmento <strong>{SEGMENTO_LABEL[sug.segmento ?? ""] ?? sug.segmento}</strong>
                {objetivo != null ? <> · objetivo <strong>{objetivo} kWp</strong></> : <> · sin capacidad definida en Sistema</>}
                {sug.mejor ? (
                  <> · sugerido: <strong>{sug.mejor.nombre}</strong>{sug.cubre ? " (cubre)" : " (no cubre del todo)"}</>
                ) : null}
              </p>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <label htmlFor="sel-paquete" className="block text-xs font-medium text-muted-foreground">
                    Paquete
                  </label>
                  <select
                    id="sel-paquete"
                    value={selId}
                    onChange={(e) => setSelId(e.target.value)}
                    disabled={aplicando}
                    className={SELECT_CLASS}
                  >
                    {candidatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {c.capacidadKwp != null ? ` · ${c.capacidadKwp} kWp` : ""} · {fmtMxn(c.total)}
                        {c.desactualizadas > 0 ? ` · ${c.desactualizadas} precio(s) desact.` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" size="sm" onClick={aplicar} disabled={aplicando || !selId}>
                  <Check className="size-4" aria-hidden />
                  {aplicando ? "Aplicando…" : "Aplicar paquete"}
                </Button>
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={reemplazar}
                  onChange={(e) => setReemplazar(e.target.checked)}
                  disabled={aplicando}
                  className="size-4 rounded border-border"
                />
                Reemplazar las partidas actuales (si lo desmarcas, solo se aplica cuando no hay partidas).
              </label>

              {noCubre ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  El paquete elegido ({seleccionado?.capacidadKwp ?? "?"} kWp) no cubre la capacidad objetivo ({objetivo} kWp).
                </p>
              ) : null}
              {seleccionado && seleccionado.desactualizadas > 0 ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  Este paquete tiene {seleccionado.desactualizadas} precio(s) desactualizado(s) respecto al catálogo.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No hay paquetes activos para el segmento{" "}
              <strong>{SEGMENTO_LABEL[sug.segmento ?? ""] ?? sug.segmento}</strong>.
            </p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            Toma un paquete pre-armado como partidas de la cotización (no modifica el paso Sistema).
          </p>
        )}

        {error ? <span className="text-sm text-destructive">{error}</span> : null}
        {okMsg ? <span className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</span> : null}
      </CardContent>
    </Card>
  )
}
