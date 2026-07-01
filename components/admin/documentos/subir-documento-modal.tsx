"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"

import { documentoTipo } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/admin/ui/modal"
import { labelFor } from "@/components/admin/ui/status-badge"
import {
  EntidadPicker,
  type EntidadSeleccionada,
} from "@/components/admin/actividades/entidad-picker"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx," +
  "image/*,application/pdf"

const TIPOS: ReadonlyArray<string> = documentoTipo.enumValues

export interface SubirDocumentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama tras subir con éxito (para recargar el listado). */
  onSubido: () => void
}

/**
 * Modal de subida de documento desde el listado global: elige la entidad dueña
 * (lead/cliente/oportunidad/cotización/proyecto) con el selector buscable, el
 * tipo y el archivo, y sube a M365 vía POST /api/je-admin/documentos/upload.
 */
export function SubirDocumentoModal({ open, onOpenChange, onSubido }: SubirDocumentoModalProps) {
  const router = useRouter()
  const [entidad, setEntidad] = useState<EntidadSeleccionada | null>(null)
  const [tipo, setTipo] = useState<string>(TIPOS[0] ?? "otro")
  const [nombre, setNombre] = useState("")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset(): void {
    setEntidad(null)
    setTipo(TIPOS[0] ?? "otro")
    setNombre("")
    setArchivo(null)
    setFileKey((k) => k + 1)
    setError(null)
  }

  function cerrar(): void {
    if (subiendo) return
    reset()
    onOpenChange(false)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!entidad) {
      setError("Selecciona la entidad a la que pertenece el documento.")
      return
    }
    if (!archivo) {
      setError("Selecciona un archivo para subir.")
      return
    }

    const fd = new FormData()
    fd.append("file", archivo)
    fd.append("entidadTipo", entidad.tipo)
    fd.append("entidadId", entidad.id)
    fd.append("tipo", tipo)
    fd.append("nombre", nombre.trim() === "" ? archivo.name : nombre.trim())

    setSubiendo(true)
    try {
      const res = await fetch("/api/je-admin/documentos/upload", { method: "POST", body: fd })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) {
        setError(
          j.error ??
            (res.status === 503
              ? "La subida de documentos no está configurada."
              : "No se pudo subir el documento."),
        )
        return
      }
      reset()
      onOpenChange(false)
      onSubido()
      router.refresh()
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) cerrar()
      }}
      title="Subir documento"
      description="Elige la entidad, el tipo y el archivo. Se guarda en M365."
      size="2xl"
      dismissable={!subiendo}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <EntidadPicker value={entidad} onChange={setEntidad} disabled={subiendo} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-tipo">Tipo</Label>
            <select
              id="doc-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={subiendo}
              className={SELECT_CLASS}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-nombre">Nombre (opcional)</Label>
            <Input
              id="doc-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={archivo?.name ?? "Nombre del archivo"}
              disabled={subiendo}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doc-file">Archivo</Label>
          <Input
            key={fileKey}
            id="doc-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            disabled={subiendo}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={subiendo || !archivo || !entidad}>
            <Upload className="size-4" aria-hidden /> {subiendo ? "Subiendo…" : "Subir"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={subiendo} onClick={cerrar}>
            Cancelar
          </Button>
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </div>
      </form>
    </Modal>
  )
}
