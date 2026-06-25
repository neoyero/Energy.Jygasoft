"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { leadCanal, usoInmueble } from "@/db/schema"
import { crearLead, actualizarLead } from "@/lib/admin/actions"
import type {
  LeadCanal,
  LeadFormData,
  LeadRecord,
  UsoInmueble,
  VendedorOption,
} from "@/lib/admin/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const CANAL_LABELS: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  organico: "Orgánico",
  directo: "Directo",
  referido: "Referido",
  otro: "Otro",
}

const USO_LABELS: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  mixto: "Mixto",
  industrial: "Industrial",
}

export interface LeadFormProps {
  modo: "crear" | "editar"
  /** Registro a precargar (obligatorio en modo "editar"). */
  lead?: LeadRecord
  vendedores: ReadonlyArray<VendedorOption>
  /** Callback opcional tras guardar con éxito (p. ej. cerrar el panel). */
  onSuccess?: () => void
}

/** Estado interno del form: strings controlados (los vacíos -> null al enviar). */
interface FormState {
  nombre: string
  email: string
  telefono: string
  segmento: string
  uso: string
  cp: string
  colonia: string
  municipio: string
  estadoMx: string
  consumoKwhMes: string
  reciboMxn: string
  esTitular: boolean
  esPropietario: boolean
  canal: string
  consentimientoDatos: boolean
  consentimientoMarketing: boolean
  notas: string
  vendedorId: string
}

/** "" -> null para columnas opcionales. */
function nullable(v: string): string | null {
  const t = v.trim()
  return t === "" ? null : t
}

/** Construye el estado inicial a partir del lead (o vacíos en alta). */
function estadoInicial(lead?: LeadRecord): FormState {
  return {
    nombre: lead?.nombre ?? "",
    email: lead?.email ?? "",
    telefono: lead?.telefono ?? "",
    segmento: lead?.segmento ?? "",
    uso: lead?.uso ?? "",
    cp: lead?.cp ?? "",
    colonia: lead?.colonia ?? "",
    municipio: lead?.municipio ?? "",
    estadoMx: lead?.estadoMx ?? "",
    consumoKwhMes: lead?.consumoKwhMes ?? "",
    reciboMxn: lead?.reciboMxn ?? "",
    esTitular: lead?.esTitular ?? false,
    esPropietario: lead?.esPropietario ?? false,
    canal: lead?.canal ?? "directo",
    consentimientoDatos: lead?.consentimientoDatos ?? false,
    consentimientoMarketing: lead?.consentimientoMarketing ?? false,
    notas: lead?.notas ?? "",
    vendedorId: lead?.vendedorId ?? "",
  }
}

/**
 * Formulario controlado de alta/edición de lead. No incluye campos derivados
 * (score, sizing, inversión, utm): esos llegan por la calculadora o integración.
 * Llama a crearLead / actualizarLead en useTransition y, al éxito, refresca la
 * ruta (RSC) e invoca onSuccess (cierre del panel).
 */
export function LeadForm({ modo, lead, vendedores, onSuccess }: LeadFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => estadoInicial(lead))

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setError(null)

    const payload: LeadFormData = {
      nombre: nullable(form.nombre),
      email: nullable(form.email),
      telefono: nullable(form.telefono),
      segmento:
        form.segmento === ""
          ? null
          : (form.segmento as "residencial" | "negocio"),
      uso: form.uso === "" ? null : (form.uso as UsoInmueble),
      cp: nullable(form.cp),
      colonia: nullable(form.colonia),
      municipio: nullable(form.municipio),
      estadoMx: nullable(form.estadoMx),
      consumoKwhMes: nullable(form.consumoKwhMes),
      reciboMxn: nullable(form.reciboMxn),
      esTitular: form.esTitular,
      esPropietario: form.esPropietario,
      canal: form.canal as LeadCanal,
      consentimientoDatos: form.consentimientoDatos,
      consentimientoMarketing: form.consentimientoMarketing,
      notas: nullable(form.notas),
      vendedorId: nullable(form.vendedorId),
    }

    startTransition(async () => {
      const res =
        modo === "editar" && lead
          ? await actualizarLead(lead.id, payload)
          : await crearLead(payload)

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
      className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {/* Contacto */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="lead-nombre">Nombre</Label>
        <Input
          id="lead-nombre"
          value={form.nombre}
          onChange={(e) => set("nombre", e.target.value)}
          disabled={pending}
          placeholder="Nombre del prospecto"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-telefono">Teléfono</Label>
        <Input
          id="lead-telefono"
          value={form.telefono}
          onChange={(e) => set("telefono", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-email">Correo</Label>
        <Input
          id="lead-email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-segmento">Segmento</Label>
        <select
          id="lead-segmento"
          value={form.segmento}
          onChange={(e) => set("segmento", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin especificar</option>
          <option value="residencial">Residencial</option>
          <option value="negocio">Negocio</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-uso">Uso del inmueble</Label>
        <select
          id="lead-uso"
          value={form.uso}
          onChange={(e) => set("uso", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          <option value="">Sin especificar</option>
          {usoInmueble.enumValues.map((u) => (
            <option key={u} value={u}>
              {USO_LABELS[u] ?? u}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-canal">Canal</Label>
        <select
          id="lead-canal"
          value={form.canal}
          onChange={(e) => set("canal", e.target.value)}
          disabled={pending}
          className={SELECT_CLASS}
        >
          {leadCanal.enumValues.map((c) => (
            <option key={c} value={c}>
              {CANAL_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      {/* Ubicación */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-cp">CP</Label>
        <Input
          id="lead-cp"
          value={form.cp}
          onChange={(e) => set("cp", e.target.value)}
          disabled={pending}
          inputMode="numeric"
          maxLength={5}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-colonia">Colonia</Label>
        <Input
          id="lead-colonia"
          value={form.colonia}
          onChange={(e) => set("colonia", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-municipio">Municipio</Label>
        <Input
          id="lead-municipio"
          value={form.municipio}
          onChange={(e) => set("municipio", e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-estado">Estado</Label>
        <Input
          id="lead-estado"
          value={form.estadoMx}
          onChange={(e) => set("estadoMx", e.target.value)}
          disabled={pending}
        />
      </div>

      {/* Consumo */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-consumo">Consumo (kWh/mes)</Label>
        <Input
          id="lead-consumo"
          value={form.consumoKwhMes}
          onChange={(e) => set("consumoKwhMes", e.target.value)}
          disabled={pending}
          inputMode="decimal"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-recibo">Recibo (MXN)</Label>
        <Input
          id="lead-recibo"
          value={form.reciboMxn}
          onChange={(e) => set("reciboMxn", e.target.value)}
          disabled={pending}
          inputMode="decimal"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lead-vendedor">Asesor</Label>
        <select
          id="lead-vendedor"
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

      {/* Flags */}
      <div className="flex flex-col justify-center gap-2 sm:col-span-2 lg:col-span-1">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.esTitular}
            onChange={(e) => set("esTitular", e.target.checked)}
            disabled={pending}
            className="size-4 rounded border-border"
          />
          Es titular del servicio
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.esPropietario}
            onChange={(e) => set("esPropietario", e.target.checked)}
            disabled={pending}
            className="size-4 rounded border-border"
          />
          Es propietario del inmueble
        </label>
      </div>

      {/* Consentimientos */}
      <div className="flex flex-col justify-center gap-2 sm:col-span-2 lg:col-span-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.consentimientoDatos}
            onChange={(e) => set("consentimientoDatos", e.target.checked)}
            disabled={pending}
            className="size-4 rounded border-border"
          />
          Consiente el tratamiento de datos
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.consentimientoMarketing}
            onChange={(e) => set("consentimientoMarketing", e.target.checked)}
            disabled={pending}
            className="size-4 rounded border-border"
          />
          Acepta comunicaciones de marketing
        </label>
      </div>

      {/* Notas */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="lead-notas">Notas</Label>
        <textarea
          id="lead-notas"
          value={form.notas}
          onChange={(e) => set("notas", e.target.value)}
          disabled={pending}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Guardando…"
            : modo === "editar"
              ? "Guardar cambios"
              : "Crear lead"}
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
