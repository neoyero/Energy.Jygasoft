"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { tipoPersona, nivelTension } from "@/db/schema"
import { regimenesPara } from "@/lib/sat/regimen-fiscal"
import { crearCliente, actualizarCliente } from "@/lib/admin/actions"
import type {
  ClienteDetalle,
  TipoPersona,
  VendedorOption,
} from "@/lib/admin/queries"
import { labelFor } from "@/components/admin/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const FIELDSET_CLASS =
  "grid gap-4 rounded-lg border border-border p-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3"

const LEGEND_CLASS =
  "px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"

/** Cliente completo para precargar el form en modo "editar". */
type ClienteFull = ClienteDetalle["cliente"]

export interface ClienteFormProps {
  modo: "crear" | "editar"
  /** Datos a precargar (obligatorio en modo "editar"). */
  cliente?: ClienteFull
  vendedores: ReadonlyArray<VendedorOption>
  /** Callback opcional tras guardar con exito (ej. cerrar drawer). */
  onSuccess?: () => void
}

/** Estado interno del form: strings controlados (los vacios -> null al enviar). */
interface FormState {
  tipoPersona: TipoPersona
  nombre: string
  rfc: string
  curp: string
  regimenFiscal: string
  csfActualizadaAt: string
  email: string
  telefono: string
  domicilio: string
  municipio: string
  estadoMx: string
  cp: string
  municipioId: string
  numeroServicioCfe: string
  tarifa: string
  nivelTension: string
  titularCfe: string
  titularCoincide: boolean
  vendedorId: string
  notas: string
}

const TIPOS = tipoPersona.enumValues
const TENSIONES = nivelTension.enumValues

/** Construye el estado inicial a partir del cliente (o vacios en alta). */
function estadoInicial(cliente?: ClienteFull): FormState {
  return {
    tipoPersona: (cliente?.tipoPersona ?? TIPOS[0]) as TipoPersona,
    nombre: cliente?.nombre ?? "",
    rfc: cliente?.rfc ?? "",
    curp: cliente?.curp ?? "",
    regimenFiscal: cliente?.regimenFiscal ?? "",
    csfActualizadaAt: cliente?.csfActualizadaAt ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    domicilio: cliente?.domicilio ?? "",
    municipio: cliente?.municipio ?? "",
    estadoMx: cliente?.estadoMx ?? "",
    cp: cliente?.cp ?? "",
    municipioId:
      cliente?.municipioId != null ? String(cliente.municipioId) : "",
    numeroServicioCfe: cliente?.numeroServicioCfe ?? "",
    tarifa: cliente?.tarifa ?? "",
    nivelTension: cliente?.nivelTension ?? "",
    titularCfe: cliente?.titularCfe ?? "",
    titularCoincide: cliente?.titularCoincide ?? false,
    vendedorId: cliente?.vendedorId ?? "",
    notas: cliente?.notas ?? "",
  }
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/**
 * Formulario controlado de alta/edicion de cliente. Llama a crearCliente /
 * actualizarCliente dentro de useTransition y maneja el ActionResult. Al exito
 * refresca la ruta (router.refresh) e invoca onSuccess (cierre del drawer).
 */
export function ClienteForm({
  modo,
  cliente,
  vendedores,
  onSuccess,
}: ClienteFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(cliente))

  // Parche inmutable de un campo del form.
  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const esPF = form.tipoPersona.startsWith("pf_")

  // Régimenes fiscales SAT aplicables al tipo de persona actual.
  const regimenesDisponibles = regimenesPara(form.tipoPersona)

  // Cambio de tipo de persona: limpia CURP si pasa a PM y el régimen fiscal si
  // deja de aplicar al nuevo tipo (física/moral).
  function onTipoPersonaChange(value: TipoPersona): void {
    const validos = new Set(regimenesPara(value).map((r) => r.clave))
    setForm((prev) => ({
      ...prev,
      tipoPersona: value,
      curp: value.startsWith("pf_") ? prev.curp : "",
      regimenFiscal: validos.has(prev.regimenFiscal) ? prev.regimenFiscal : "",
    }))
  }

  // Checkbox "el titular CFE coincide con el cliente": copia/limpia el titular.
  function onTitularCoincideChange(checked: boolean): void {
    setForm((prev) => ({
      ...prev,
      titularCoincide: checked,
      titularCfe: checked ? prev.nombre : prev.titularCfe,
    }))
  }

  // Si coincide el titular, mantenlo sincronizado con el nombre.
  function onNombreChange(value: string): void {
    setForm((prev) => ({
      ...prev,
      nombre: value,
      titularCfe: prev.titularCoincide ? value : prev.titularCfe,
    }))
  }

  // CP -> municipio + estado (+ municipioId) vía BD SEPOMEX. Mismo patrón que
  // calc-form: try/catch silencioso para no romper sin conexión.
  async function onCpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    set("cp", raw)
    const cp = raw.replace(/\D/g, "")
    if (cp.length !== 5) return
    try {
      const r = await fetch(`/api/cp/${cp}`)
      const j = (await r.json()) as {
        found?: boolean
        municipio?: string | null
        estado?: string | null
        municipioId?: number | string | null
      }
      if (!j.found) return
      setForm((prev) => ({
        ...prev,
        municipio: j.municipio ?? prev.municipio,
        estadoMx: j.estado ?? prev.estadoMx,
        municipioId:
          j.municipioId != null ? String(j.municipioId) : prev.municipioId,
      }))
    } catch {
      /* sin conexión: el usuario puede escribir el municipio/estado */
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload = {
      tipoPersona: form.tipoPersona,
      nombre: form.nombre.trim(),
      rfc: nullable(form.rfc),
      curp: esPF ? nullable(form.curp) : null,
      regimenFiscal: nullable(form.regimenFiscal),
      csfActualizadaAt: nullable(form.csfActualizadaAt),
      email: nullable(form.email),
      telefono: nullable(form.telefono),
      domicilio: nullable(form.domicilio),
      municipio: nullable(form.municipio),
      estadoMx: nullable(form.estadoMx),
      cp: nullable(form.cp),
      municipioId: nullable(form.municipioId),
      numeroServicioCfe: nullable(form.numeroServicioCfe),
      tarifa: nullable(form.tarifa),
      nivelTension: nullable(form.nivelTension) as
        | "bt_monofasica"
        | "bt_trifasica"
        | "mt1"
        | "mt2"
        | null,
      titularCfe: nullable(form.titularCfe),
      titularCoincide: form.titularCoincide,
      vendedorId: nullable(form.vendedorId),
      notas: nullable(form.notas),
    }

    startTransition(async () => {
      const res =
        modo === "editar" && cliente
          ? await actualizarCliente(cliente.id, payload)
          : await crearCliente(payload)

      if (!res.ok) {
        setError(res.error)
        return
      }

      router.refresh()
      onSuccess?.()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Identidad / Fiscal */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Identidad / Fiscal</legend>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-tipo">Tipo de persona</Label>
          <select
            id="cliente-tipo"
            value={form.tipoPersona}
            onChange={(e) =>
              onTipoPersonaChange(e.target.value as TipoPersona)
            }
            disabled={pending}
            className={SELECT_CLASS}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {labelFor(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cliente-nombre">Nombre / Razón social</Label>
          <Input
            id="cliente-nombre"
            value={form.nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            disabled={pending}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-rfc">RFC</Label>
          <Input
            id="cliente-rfc"
            value={form.rfc}
            onChange={(e) => set("rfc", e.target.value)}
            disabled={pending}
          />
        </div>

        {esPF ? (
          <div className="space-y-1.5">
            <Label htmlFor="cliente-curp">CURP</Label>
            <Input
              id="cliente-curp"
              value={form.curp}
              onChange={(e) => set("curp", e.target.value)}
              disabled={pending}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="cliente-regimen">Régimen fiscal</Label>
          <select
            id="cliente-regimen"
            value={form.regimenFiscal}
            onChange={(e) => set("regimenFiscal", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin especificar</option>
            {regimenesDisponibles.map((r) => (
              <option key={r.clave} value={r.clave}>
                {r.clave} — {r.descripcion}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-csf">CSF actualizada</Label>
          <Input
            id="cliente-csf"
            type="date"
            value={form.csfActualizadaAt}
            onChange={(e) => set("csfActualizadaAt", e.target.value)}
            disabled={pending}
          />
        </div>
      </fieldset>

      {/* Contacto y domicilio */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Contacto y domicilio</legend>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-email">Correo</Label>
          <Input
            id="cliente-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-telefono">Teléfono</Label>
          <Input
            id="cliente-telefono"
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="cliente-cp">CP</Label>
          <Input
            id="cliente-cp"
            inputMode="numeric"
            maxLength={5}
            value={form.cp}
            onChange={onCpChange}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="cliente-domicilio">Domicilio</Label>
          <Input
            id="cliente-domicilio"
            value={form.domicilio}
            onChange={(e) => set("domicilio", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-municipio">Municipio</Label>
          <Input
            id="cliente-municipio"
            value={form.municipio}
            onChange={(e) => set("municipio", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-estado">Estado</Label>
          <Input
            id="cliente-estado"
            value={form.estadoMx}
            onChange={(e) => set("estadoMx", e.target.value)}
            disabled={pending}
          />
        </div>

        {/* municipioId: derivado del CP, no editable directamente. */}
        <input type="hidden" name="municipioId" value={form.municipioId} />
      </fieldset>

      {/* CFE */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>CFE</legend>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-cfe">No. servicio CFE</Label>
          <Input
            id="cliente-cfe"
            value={form.numeroServicioCfe}
            onChange={(e) => set("numeroServicioCfe", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-tarifa">Tarifa</Label>
          <Input
            id="cliente-tarifa"
            value={form.tarifa}
            onChange={(e) => set("tarifa", e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-tension">Nivel de tensión</Label>
          <select
            id="cliente-tension"
            value={form.nivelTension}
            onChange={(e) => set("nivelTension", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin especificar</option>
            {TENSIONES.map((n) => (
              <option key={n} value={n}>
                {labelFor(n)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.titularCoincide}
              onChange={(e) => onTitularCoincideChange(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-brand-green"
            />
            El titular del servicio CFE es el mismo cliente
          </label>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cliente-titular">Titular del servicio CFE</Label>
          <Input
            id="cliente-titular"
            value={form.titularCfe}
            onChange={(e) => set("titularCfe", e.target.value)}
            disabled={pending || form.titularCoincide}
          />
        </div>
      </fieldset>

      {/* Comercial */}
      <fieldset className={FIELDSET_CLASS}>
        <legend className={LEGEND_CLASS}>Comercial</legend>

        <div className="space-y-1.5">
          <Label htmlFor="cliente-vendedor">Vendedor</Label>
          <select
            id="cliente-vendedor"
            value={form.vendedorId}
            onChange={(e) => set("vendedorId", e.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            <option value="">Sin asignar</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="cliente-notas">Notas</Label>
          <textarea
            id="cliente-notas"
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            disabled={pending}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Guardando…"
            : modo === "editar"
              ? "Guardar cambios"
              : "Crear cliente"}
        </Button>
        {onSuccess ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onSuccess}
          >
            Cancelar
          </Button>
        ) : null}
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  )
}
