-- =====================================================================
-- 0018 — Integraciones/configuraciones en BD (secretos cifrados).
-- Una fila por conexión externa: `ajustes` (jsonb en claro) + `secretos`
-- (jsonb cifrado con AES-256-GCM; la llave vive solo en el env). Complementa a
-- config_parametros (parámetros de negocio no sensibles). Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS integraciones (
  clave           text PRIMARY KEY,
  nombre          text NOT NULL,
  descripcion     text,
  activo          boolean NOT NULL DEFAULT true,
  ajustes         jsonb NOT NULL DEFAULT '{}',
  secretos        jsonb NOT NULL DEFAULT '{}',
  actualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_integraciones_upd ON integraciones;
CREATE TRIGGER trg_integraciones_upd BEFORE UPDATE ON integraciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
