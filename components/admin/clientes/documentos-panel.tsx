"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Trash2, Upload } from "lucide-react"

import { eliminarDocumento } from "@/lib/admin/actions"
import type { ClienteDocumentoRow } from "@/lib/admin/queries"
import { fmtFechaRel } from "@/lib/admin/format"
import { documentoTipo } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/admin/ui/confirm-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge, labelFor } from "@/components/admin/ui/status-badge"

export interface DocumentosPanelProps {
  clienteId: string
  documentos: ReadonlyArray<ClienteDocumentoRow>
  /** RBAC documentos:edit -> habilita subida/borrado. */
  puedeEditar: boolean
}

/** Tipos de documento del enum, como valor por defecto el primero. */
const TIPOS: ReadonlyArray<string> = documentoTipo.enumValues
const TIPO_DEFAULT: string = TIPOS[0] ?? "otro"

/**
 * Extensiones aceptadas por el input file. No bloquea otros tipos
 * (el navegador solo sugiere), pero acota lo razonable: pdf, imagenes, office.
 */
const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx," +
  "image/*,application/pdf"

/** Forma esperada de la respuesta de la ruta de subida. */
interface UploadOk {
  ok: true
  id: string
  url: string
  nombre: string
}

interface UploadErr {
  ok: false
  error: string
}

type UploadResponse = UploadOk | UploadErr

/** Type guard tolerante para el JSON de la ruta (boundary externo). */
function parseUploadResponse(value: unknown): UploadResponse {
  if (typeof value === "object" && value !== null && "ok" in value) {
    const obj = value as Record<string, unknown>
    if (obj.ok === true) {
      return {
        ok: true,
        id: String(obj.id ?? ""),
        url: String(obj.url ?? ""),
        nombre: String(obj.nombre ?? ""),
      }
    }
    if (obj.ok === false) {
      return {
        ok: false,
        error:
          typeof obj.error === "string" && obj.error.trim() !== ""
            ? obj.error
            : "No se pudo subir el documento.",
      }
    }
  }
  return { ok: false, error: "Respuesta inesperada del servidor." }
}

/**
 * Panel de documentos de un cliente. Lista los documentos (tipo + enlace
 * externo + fecha) y, si el rol puede editar, permite subir archivos reales a
 * SharePoint via POST /api/je-admin/documentos/upload y borrarlos via la server
 * action eliminarDocumento. Refresca la ruta al exito.
 */
export function DocumentosPanel({
  clienteId,
  documentos,
  puedeEditar,
}: DocumentosPanelProps) {
  const router = useRouter()
  const [borrando, startBorrado] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState<string>(TIPO_DEFAULT)
  const [nombre, setNombre] = useState("")
  const [archivo, setArchivo] = useState<File | null>(null)
  // Cambiar la key fuerza el remontaje del <input file> para limpiarlo.
  const [fileKey, setFileKey] = useState(0)

  const ocupado = subiendo || borrando

  function onArchivoChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setError(null)
    const file = e.target.files?.[0] ?? null
    setArchivo(file)
  }

  function limpiarForm(): void {
    setArchivo(null)
    setNombre("")
    setTipo(TIPO_DEFAULT)
    setFileKey((k) => k + 1)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)

    if (!archivo) {
      setError("Selecciona un archivo para subir.")
      return
    }

    const nombreFinal = nombre.trim() === "" ? archivo.name : nombre.trim()

    const formData = new FormData()
    formData.append("file", archivo)
    formData.append("entidadId", clienteId)
    formData.append("tipo", tipo)
    formData.append("nombre", nombreFinal)

    setSubiendo(true)
    try {
      const res = await fetch("/api/je-admin/documentos/upload", {
        method: "POST",
        body: formData,
      })

      let parsed: UploadResponse
      try {
        parsed = parseUploadResponse(await res.json())
      } catch {
        parsed = {
          ok: false,
          error:
            res.status === 503
              ? "La subida de documentos no está configurada."
              : "No se pudo procesar la respuesta del servidor.",
        }
      }

      if (!parsed.ok) {
        setError(parsed.error)
        return
      }

      limpiarForm()
      router.refresh()
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.")
    } finally {
      setSubiendo(false)
    }
  }

  function borrar(id: string): void {
    setError(null)
    startBorrado(async () => {
      const res = await eliminarDocumento(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar ? (
        <p className="text-sm text-muted-foreground">
          {documentos.length} documento{documentos.length === 1 ? "" : "s"}
        </p>
      ) : null}

      {/* Bloque de subida */}
      {puedeEditar ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="documento-file">Archivo</Label>
            <Input
              key={fileKey}
              id="documento-file"
              type="file"
              accept={ACCEPT}
              onChange={onArchivoChange}
              disabled={ocupado}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="documento-tipo">Tipo</Label>
            <select
              id="documento-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={ocupado}
              className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {labelFor(t)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="documento-nombre">Nombre (opcional)</Label>
            <Input
              id="documento-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={archivo?.name ?? "Nombre del archivo"}
              disabled={ocupado}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={ocupado || !archivo}>
              <Upload className="size-4" aria-hidden />
              {subiendo ? "Subiendo…" : "Subir"}
            </Button>
            {error ? (
              <span className="text-sm text-destructive">{error}</span>
            ) : null}
          </div>
        </form>
      ) : null}

      {/* Error fuera del form (ej. al borrar sin form visible) */}
      {error && !puedeEditar ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}

      {/* Lista de documentos */}
      {documentos.length === 0 ? (
        <EmptyState
          title="Sin documentos"
          description="Este cliente no tiene documentos cargados."
          size="sm"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {documentos.map((doc) => (
            <li
              key={doc.id}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <StatusBadge value={doc.tipo} withDot={false} />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{doc.nombre}</span>
                    <ExternalLink
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </a>
                  <time className="block text-xs text-muted-foreground">
                    {fmtFechaRel(doc.createdAt)}
                  </time>
                </div>

                {puedeEditar ? (
                  <ConfirmButton
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Eliminar documento"
                    disabled={ocupado}
                    destructive
                    title="Eliminar documento"
                    description={
                      <>
                        Se eliminará el documento{" "}
                        <strong>{doc.nombre}</strong>. Esta acción no se puede
                        deshacer. ¿Continuar?
                      </>
                    }
                    confirmLabel="Eliminar"
                    onConfirm={() => borrar(doc.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  </ConfirmButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
