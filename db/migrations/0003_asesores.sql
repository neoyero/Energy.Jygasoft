-- =====================================================================
-- 0003 — Asesores: usuarios habilitados para recibir/atender leads.
-- Lleva el agente de Chatwoot y reglas de ruteo (zonas/segmentos) para el
-- reparto automático (round-robin por `asignaciones`). Solo los usuarios con
-- un asesor activo y vinculado pueden asignarse a un lead.
-- Idempotente: seguro de re-ejecutar.
-- =====================================================================

CREATE TABLE IF NOT EXISTS asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  chatwoot_agent_id integer NOT NULL,
  ms_email text,
  telefono text,
  zonas text[] NOT NULL DEFAULT '{}',       -- municipios o CP que cubre (vacío = todas)
  segmentos text[] NOT NULL DEFAULT '{}',    -- {residencial,negocio} (vacío = ambos)
  activo boolean NOT NULL DEFAULT true,
  asignaciones integer NOT NULL DEFAULT 0,   -- contador para round-robin / carga
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_asesores_activo ON asesores (activo);

-- Mantiene updated_at en cada UPDATE (misma función que el resto del esquema).
DROP TRIGGER IF EXISTS trg_asesores_upd ON asesores;
CREATE TRIGGER trg_asesores_upd BEFORE UPDATE ON asesores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
