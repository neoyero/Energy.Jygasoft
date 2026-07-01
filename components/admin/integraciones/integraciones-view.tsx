"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  KeyRound,
  MessagesSquare,
  Mail,
  Share2,
  Workflow,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import type { IntegracionAdmin } from "@/lib/config/service"
import {
  guardarIntegracion,
  crearIntegracion,
  revelarSecretoIntegracion,
  eliminarIntegracion,
} from "@/lib/admin/actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"

export interface IntegracionesViewProps {
  integraciones: ReadonlyArray<IntegracionAdmin>
  puedeEditar: boolean
}

/** Icono por integración conocida; el resto usa la llave genérica. */
const ICONO_POR_CLAVE: Record<string, React.ComponentType<{ className?: string }>> = {
  chatwoot: MessagesSquare,
  m365: Mail,
  meta: Share2,
  n8n: Workflow,
  gemini: Sparkles,
  turnstile: ShieldCheck,
}

function iconoDe(clave: string): React.ComponentType<{ className?: string }> {
  return ICONO_POR_CLAVE[clave] ?? KeyRound
}

export function IntegracionesView({ integraciones, puedeEditar }: IntegracionesViewProps) {
  const [nuevaOpen, setNuevaOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {integraciones.length} conexi{integraciones.length === 1 ? "ón" : "ones"}. Toca una tarjeta
            para configurarla.
          </p>
          <Button size="sm" onClick={() => setNuevaOpen(true)} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden /> Nueva integración
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {integraciones.map((i) => (
          <IntegracionCard key={i.clave} integracion={i} puedeEditar={puedeEditar} />
        ))}
      </div>

      {puedeEditar ? <NuevaIntegracionModal open={nuevaOpen} onOpenChange={setNuevaOpen} /> : null}
    </div>
  )
}

/* ── Badge de estado ──────────────────────────────────────────────────────── */

function EstadoBadge({ activo, configurada }: { activo: boolean; configurada: boolean }) {
  const { texto, clase } = !activo
    ? {
        texto: "Deshabilitada",
        clase:
          "bg-stone-100 text-stone-600 dark:bg-muted dark:text-muted-foreground",
      }
    : configurada
      ? {
          texto: "Activa",
          clase:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        }
      : {
          texto: "Incompleta",
          clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", clase)}>
      {texto}
    </span>
  )
}

/* ── Tarjeta colapsable ───────────────────────────────────────────────────── */

function IntegracionCard({
  integracion,
  puedeEditar,
}: {
  integracion: IntegracionAdmin
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activo, setActivo] = useState(integracion.activo)
  const [ajustes, setAjustes] = useState<Record<string, string>>(
    Object.fromEntries(integracion.ajustes.map((a) => [a.campo, a.valor])),
  )
  // Los secretos arrancan vacíos (write-only): vacío = no cambiar.
  const [secretos, setSecretos] = useState<Record<string, string>>({})
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  const Icono = iconoDe(integracion.clave)

  function guardar(): void {
    setMsg(null)
    setError(null)
    const secretosNoVacios: Record<string, string> = {}
    for (const [k, v] of Object.entries(secretos)) {
      if (v.trim() !== "") secretosNoVacios[k] = v.trim()
    }
    startTransition(async () => {
      const res = await guardarIntegracion(integracion.clave, {
        activo,
        ajustes,
        secretos: secretosNoVacios,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSecretos({})
      setMsg("Guardado.")
      router.refresh()
    })
  }

  function borrar(): void {
    setError(null)
    startTransition(async () => {
      const res = await eliminarIntegracion(integracion.clave)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Encabezado colapsable */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
          <Icono className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-foreground">{integracion.nombre}</span>
            <EstadoBadge activo={integracion.activo} configurada={integracion.configurada} />
            {integracion.custom ? (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                Personalizada
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground sm:line-clamp-1">
            {integracion.descripcion}
          </span>
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          <span className="hidden sm:inline">Configurar</span>
          <ChevronDown className={cn("size-4 transition-transform", abierto && "rotate-180")} />
        </span>
      </button>

      {/* Cuerpo expandible */}
      {abierto ? (
        <div className="border-t border-border px-4 py-4">
          <div className="grid gap-3">
            {integracion.ajustes.map((a) => (
              <div key={a.campo} className="space-y-1">
                <Label htmlFor={`${integracion.clave}-${a.campo}`}>{a.label}</Label>
                <Input
                  id={`${integracion.clave}-${a.campo}`}
                  value={ajustes[a.campo] ?? ""}
                  onChange={(e) => setAjustes((p) => ({ ...p, [a.campo]: e.target.value }))}
                  disabled={!puedeEditar || pending}
                />
                {a.fromEnv ? (
                  <p className="text-[11px] text-muted-foreground">
                    Valor actual desde variable de entorno.
                  </p>
                ) : null}
              </div>
            ))}

            {integracion.secretos.map((s) => (
              <SecretoField
                key={s.campo}
                clave={integracion.clave}
                campo={s.campo}
                label={s.label}
                configurado={s.configurado}
                fromEnv={s.fromEnv}
                value={secretos[s.campo] ?? ""}
                onChange={(v) => setSecretos((p) => ({ ...p, [s.campo]: v }))}
                disabled={!puedeEditar || pending}
              />
            ))}

            {integracion.ajustes.length + integracion.secretos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Esta integración no tiene campos.</p>
            ) : null}

            {puedeEditar ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    disabled={pending}
                    className="size-4 rounded border-border"
                  />
                  Activa
                </label>
                <Button size="sm" onClick={guardar} disabled={pending}>
                  {pending ? "Guardando…" : "Guardar"}
                </Button>
                {integracion.custom ? (
                  confirmarBorrar ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">¿Eliminar?</span>
                      <Button size="sm" variant="destructive" onClick={borrar} disabled={pending}>
                        Sí, eliminar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmarBorrar(false)}
                        disabled={pending}
                      >
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmarBorrar(true)}
                      disabled={pending}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden /> Eliminar
                    </Button>
                  )
                ) : null}
                {msg ? <span className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</span> : null}
                {error ? <span className="text-sm text-destructive">{error}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── Campo secreto: enmascarado con ojo (revela lo escrito o el valor guardado) ── */

function SecretoField({
  clave,
  campo,
  label,
  configurado,
  fromEnv,
  value,
  onChange,
  disabled,
}: {
  clave: string
  campo: string
  label: string
  configurado: boolean
  fromEnv: boolean
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [errRevelar, setErrRevelar] = useState<string | null>(null)

  async function alternarVisible(): Promise<void> {
    setErrRevelar(null)
    // Si ya hay algo escrito, solo alterna la máscara.
    if (value.trim() !== "") {
      setVisible((v) => !v)
      return
    }
    if (visible) {
      setVisible(false)
      return
    }
    // Vacío + configurado → revela el valor guardado (acción admin explícita).
    if (!configurado) return
    setCargando(true)
    const res = await revelarSecretoIntegracion(clave, campo)
    setCargando(false)
    if (!res.ok) {
      setErrRevelar(res.error)
      return
    }
    onChange(res.valor)
    setVisible(true)
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={`${clave}-${campo}`} className="flex items-center gap-1.5">
        {label}
        <span
          title="Campo sensible: se guarda cifrado y se muestra enmascarado."
          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground"
        >
          <Lock className="size-3" aria-hidden /> Enmascarado
        </span>
      </Label>
      <div className="relative">
        <Input
          id={`${clave}-${campo}`}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pr-9"
          placeholder={
            configurado
              ? fromEnv
                ? "•••••• configurado (env) — escribe para reemplazar"
                : "•••••• configurado — escribe para reemplazar"
              : "sin definir"
          }
        />
        <button
          type="button"
          onClick={alternarVisible}
          disabled={cargando || (!configurado && value.trim() === "")}
          title={visible ? "Ocultar" : configurado && value.trim() === "" ? "Revelar valor guardado" : "Mostrar"}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {errRevelar ? <p className="text-[11px] text-destructive">{errRevelar}</p> : null}
    </div>
  )
}

/* ── Modal: nueva integración personalizada ───────────────────────────────── */

interface CampoNuevo {
  id: number
  campo: string
  valor: string
  sensible: boolean
}

function NuevaIntegracionModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clave, setClave] = useState("")
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [campos, setCampos] = useState<CampoNuevo[]>([{ id: 1, campo: "", valor: "", sensible: true }])
  const [seq, setSeq] = useState(2)

  function reset(): void {
    setError(null)
    setClave("")
    setNombre("")
    setDescripcion("")
    setCampos([{ id: 1, campo: "", valor: "", sensible: true }])
    setSeq(2)
  }

  function agregarCampo(): void {
    setCampos((p) => [...p, { id: seq, campo: "", valor: "", sensible: true }])
    setSeq((n) => n + 1)
  }

  function actualizarCampo(id: number, patch: Partial<CampoNuevo>): void {
    setCampos((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function quitarCampo(id: number): void {
    setCampos((p) => p.filter((c) => c.id !== id))
  }

  function crear(): void {
    setError(null)
    startTransition(async () => {
      const res = await crearIntegracion({
        clave,
        nombre,
        descripcion,
        campos: campos.map((c) => ({ campo: c.campo, valor: c.valor, sensible: c.sensible })),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      reset()
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
      title="Nueva integración"
      description="Guarda una conexión a medida. Marca como enmascarado cada campo sensible (token/clave)."
      dismissable={!pending}
      size="2xl"
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ni-clave">Clave (identificador)</Label>
            <Input
              id="ni-clave"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="p. ej. stripe"
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">
              Minúsculas, letras/números/-/_. No se puede cambiar luego.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ni-nombre">Nombre</Label>
            <Input
              id="ni-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="p. ej. Stripe (pagos)"
              disabled={pending}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="ni-desc">Descripción (opcional)</Label>
          <Input
            id="ni-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Campos</Label>
            <Button size="xs" variant="outline" onClick={agregarCampo} disabled={pending}>
              <Plus className="size-3" aria-hidden /> Agregar
            </Button>
          </div>

          {campos.map((c) => (
            <div key={c.id} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={c.campo}
                onChange={(e) => actualizarCampo(c.id, { campo: e.target.value })}
                placeholder="campo (p. ej. api_key)"
                disabled={pending}
              />
              <Input
                type={c.sensible ? "password" : "text"}
                autoComplete="new-password"
                value={c.valor}
                onChange={(e) => actualizarCampo(c.id, { valor: e.target.value })}
                placeholder="valor"
                disabled={pending}
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={c.sensible}
                    onChange={(e) => actualizarCampo(c.id, { sensible: e.target.checked })}
                    disabled={pending}
                    className="size-4 rounded border-border"
                  />
                  <Lock className="size-3 text-muted-foreground" aria-hidden />
                  Enmascarado
                </label>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => quitarCampo(c.id)}
                  disabled={pending || campos.length === 1}
                  title="Quitar campo"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Los campos <strong>enmascarados</strong> se cifran (AES-256-GCM) y no se muestran; el resto se
            guarda en claro.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={pending}>
            {pending ? "Creando…" : "Crear integración"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
