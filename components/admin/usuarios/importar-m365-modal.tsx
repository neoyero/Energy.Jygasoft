"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import type { EmpresaRow } from "@/lib/admin/queries"
import { ROLES } from "@/lib/admin/rbac"
import { fetchUsuariosM365, importarUsuariosM365 } from "@/lib/admin/actions"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/admin/ui/modal"

const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

interface M365Row {
  id: string
  displayName: string
  email: string
  jobTitle: string | null
  department: string | null
  phone: string | null
  accountEnabled: boolean
  yaExiste: boolean
}

function rolLabel(r: string): string {
  return r.replace(/_/g, " ")
}

export interface ImportarM365ModalProps {
  open: boolean
  empresas: ReadonlyArray<EmpresaRow>
  onClose: () => void
}

/** Importa usuarios desde la organización M365, filtrados por el dominio de la empresa. */
export function ImportarM365Modal({ open, empresas, onClose }: ImportarM365ModalProps) {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "")
  const [rol, setRol] = useState<string>("vendedor")
  const [rows, setRows] = useState<M365Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [importing, startImport] = useTransition()

  const cargar = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setError(null)
    setMsg(null)
    setSel(new Set())
    setRows([])
    const r = await fetchUsuariosM365(id)
    if (r.ok) setRows(r.data)
    else setError(r.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open && empresaId) void cargar(empresaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresaId])

  const importables = rows.filter((r) => !r.yaExiste)
  const todosSel = importables.length > 0 && importables.every((r) => sel.has(r.email))

  function toggle(email: string): void {
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(email)) n.delete(email)
      else n.add(email)
      return n
    })
  }
  function toggleTodos(): void {
    setSel(todosSel ? new Set() : new Set(importables.map((r) => r.email)))
  }

  function importar(): void {
    setError(null)
    setMsg(null)
    startImport(async () => {
      const r = await importarUsuariosM365(empresaId, [...sel], rol)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMsg(`Importados: ${r.creados ?? 0} · Omitidos (ya existían): ${r.omitidos ?? 0}.`)
      router.refresh()
      void cargar(empresaId)
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Importar usuarios de Microsoft 365"
      description="Se listan los usuarios de tu organización M365 del dominio de la empresa. Elige cuáles dar de alta."
      size="3xl"
      dismissable={!importing}
    >
      <div className="flex flex-col gap-3">
        {/* Controles */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Empresa (dominio)
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              disabled={loading || importing}
              className={SELECT_CLASS + " w-56"}
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} · {e.dominio}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Rol al importar
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              disabled={importing}
              className={SELECT_CLASS + " w-44"}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {rolLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" size="sm" variant="ghost" onClick={() => cargar(empresaId)} disabled={loading || importing}>
            <RefreshCw className="size-4" aria-hidden /> Recargar
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {msg ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            {msg}
          </div>
        ) : null}

        {/* Lista */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={todosSel}
                onChange={toggleTodos}
                disabled={loading || importing || importables.length === 0}
                className="size-4 rounded border-border"
              />
              Seleccionar todos ({importables.length} importables)
            </label>
            <span className="text-muted-foreground">{rows.length} en M365 · {sel.size} elegidos</span>
          </div>

          <div className="max-h-[45vh] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Consultando Microsoft 365…</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {error ? "—" : "Sin usuarios para este dominio."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((u) => (
                  <li key={u.id}>
                    <label
                      className={
                        "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40" +
                        (u.yaExiste ? " opacity-60" : "")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={sel.has(u.email)}
                        onChange={() => toggle(u.email)}
                        disabled={u.yaExiste || importing}
                        className="size-4 rounded border-border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium text-foreground">{u.displayName}</span>
                          {u.yaExiste ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-muted dark:text-muted-foreground">
                              ya existe
                            </span>
                          ) : null}
                          {!u.accountEnabled ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              deshabilitado
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                          {u.department ? ` · ${u.department}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={importing}>
            Cerrar
          </Button>
          <Button type="button" size="sm" onClick={importar} disabled={importing || sel.size === 0}>
            {importing ? "Importando…" : `Importar ${sel.size} seleccionado${sel.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
