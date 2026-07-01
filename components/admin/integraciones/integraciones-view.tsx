"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"

import type { IntegracionAdmin } from "@/lib/config/service"
import { guardarIntegracion } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/admin/ui/card"

export interface IntegracionesViewProps {
  integraciones: ReadonlyArray<IntegracionAdmin>
  puedeEditar: boolean
}

export function IntegracionesView({ integraciones, puedeEditar }: IntegracionesViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {integraciones.map((i) => (
        <IntegracionCard key={i.clave} integracion={i} puedeEditar={puedeEditar} />
      ))}
    </div>
  )
}

function IntegracionCard({
  integracion,
  puedeEditar,
}: {
  integracion: IntegracionAdmin
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activo, setActivo] = useState(integracion.activo)
  const [ajustes, setAjustes] = useState<Record<string, string>>(
    Object.fromEntries(integracion.ajustes.map((a) => [a.campo, a.valor])),
  )
  // Los secretos arrancan vacíos (write-only): vacío = no cambiar.
  const [secretos, setSecretos] = useState<Record<string, string>>({})

  function guardar(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setMsg(null)
    setError(null)
    // Solo enviar secretos con valor.
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

  return (
    <Card>
      <CardHeader
        action={
          <span
            className={
              integracion.configurada
                ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            }
          >
            {integracion.configurada ? "Configurada" : "Incompleta"}
          </span>
        }
      >
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden /> {integracion.nombre}
        </CardTitle>
        <CardDescription>{integracion.descripcion}</CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <form onSubmit={guardar} className="grid gap-3">
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
                <p className="text-[11px] text-muted-foreground">Valor actual desde variable de entorno.</p>
              ) : null}
            </div>
          ))}

          {integracion.secretos.map((s) => (
            <div key={s.campo} className="space-y-1">
              <Label htmlFor={`${integracion.clave}-${s.campo}`}>{s.label}</Label>
              <Input
                id={`${integracion.clave}-${s.campo}`}
                type="password"
                autoComplete="new-password"
                value={secretos[s.campo] ?? ""}
                onChange={(e) => setSecretos((p) => ({ ...p, [s.campo]: e.target.value }))}
                disabled={!puedeEditar || pending}
                placeholder={
                  s.configurado
                    ? s.fromEnv
                      ? "•••••• configurado (env) — escribe para reemplazar"
                      : "•••••• configurado — escribe para reemplazar"
                    : "sin definir"
                }
              />
            </div>
          ))}

          {puedeEditar ? (
            <div className="flex items-center gap-3 pt-1">
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
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
              {msg ? <span className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</span> : null}
              {error ? <span className="text-sm text-destructive">{error}</span> : null}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
