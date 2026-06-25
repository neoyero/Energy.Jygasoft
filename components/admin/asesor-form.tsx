"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { crearAsesor, toggleAsesorActivo } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50";

export interface UsuarioOption {
  id: string;
  nombre: string;
}

/** "" -> null; recorta espacios. */
function nullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Texto separado por comas -> array sin vacíos. */
function toList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Alta de un asesor: habilita a un usuario para recibir/atender leads. */
export function AsesorCreateForm({
  usuarios,
}: {
  usuarios: ReadonlyArray<UsuarioOption>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [usuarioId, setUsuarioId] = useState("");
  const [nombre, setNombre] = useState("");
  const [chatwootAgentId, setChatwootAgentId] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zonas, setZonas] = useState("");
  const [segResidencial, setSegResidencial] = useState(false);
  const [segNegocio, setSegNegocio] = useState(false);

  function reset(): void {
    setUsuarioId("");
    setNombre("");
    setChatwootAgentId("");
    setMsEmail("");
    setTelefono("");
    setZonas("");
    setSegResidencial(false);
    setSegNegocio(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);

    const segmentos: ("residencial" | "negocio")[] = [];
    if (segResidencial) segmentos.push("residencial");
    if (segNegocio) segmentos.push("negocio");

    startTransition(async () => {
      const res = await crearAsesor({
        usuarioId: nullable(usuarioId),
        nombre: nombre.trim(),
        chatwootAgentId: chatwootAgentId.trim(),
        msEmail: nullable(msEmail),
        telefono: nullable(telefono),
        zonas: toList(zonas),
        segmentos,
        activo: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="asesor-usuario">Usuario del panel</Label>
        <select
          id="asesor-usuario"
          value={usuarioId}
          onChange={(e) => {
            const id = e.target.value;
            setUsuarioId(id);
            // Prefill del nombre con el usuario elegido (si el campo está vacío).
            const u = usuarios.find((x) => x.id === id);
            if (u && nombre.trim() === "") setNombre(u.nombre);
          }}
          disabled={pending}
          className={selectClass}
        >
          <option value="">Sin vincular</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Solo los asesores vinculados a un usuario son asignables a leads.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asesor-nombre">Nombre</Label>
        <Input
          id="asesor-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={pending}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asesor-chatwoot">ID de agente Chatwoot</Label>
        <Input
          id="asesor-chatwoot"
          value={chatwootAgentId}
          onChange={(e) => setChatwootAgentId(e.target.value)}
          disabled={pending}
          inputMode="numeric"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asesor-msemail">Correo M365</Label>
        <Input
          id="asesor-msemail"
          type="email"
          value={msEmail}
          onChange={(e) => setMsEmail(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asesor-telefono">Teléfono</Label>
        <Input
          id="asesor-telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asesor-zonas">Zonas (municipios o CP)</Label>
        <Input
          id="asesor-zonas"
          value={zonas}
          onChange={(e) => setZonas(e.target.value)}
          disabled={pending}
          placeholder="Aguascalientes, Jesús María"
        />
        <p className="text-xs text-muted-foreground">
          Separadas por coma. Vacío = todas.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Segmentos</span>
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={segResidencial}
              onChange={(e) => setSegResidencial(e.target.checked)}
              disabled={pending}
              className="size-4 rounded border-border"
            />
            Residencial
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={segNegocio}
              onChange={(e) => setSegNegocio(e.target.checked)}
              disabled={pending}
              className="size-4 rounded border-border"
            />
            Negocio
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Vacío = ambos.</p>
      </div>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Registrar asesor"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

/** Acciones por fila: activar/desactivar a un asesor. */
export function AsesorRowActions({
  id,
  nombre,
  activo,
}: {
  id: string;
  nombre: string;
  activo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(): void {
    setError(null);
    startTransition(async () => {
      const res = await toggleAsesorActivo(id, !activo);
      if (!res.ok) {
        setError(res.error ?? "Operación fallida.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <ConfirmButton
        size="sm"
        variant={activo ? "destructive" : "outline"}
        disabled={pending}
        title={activo ? "Desactivar asesor" : "Activar asesor"}
        description={
          activo ? (
            <>
              <strong>{nombre}</strong> dejará de ser asignable a leads.
              ¿Continuar?
            </>
          ) : (
            <>
              <strong>{nombre}</strong> volverá a ser asignable a leads.
              ¿Continuar?
            </>
          )
        }
        confirmLabel={activo ? "Desactivar" : "Activar"}
        onConfirm={run}
      >
        {activo ? "Desactivar" : "Activar"}
      </ConfirmButton>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
