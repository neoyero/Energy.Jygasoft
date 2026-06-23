-- =====================================================================
-- 0001 — Códigos Postales nacionales (SEPOMEX) + HSP por estado
-- Idempotente: seguro de re-ejecutar sobre una BD existente con datos.
-- =====================================================================

CREATE TABLE IF NOT EXISTS codigos_postales (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  d_codigo          text NOT NULL,
  d_asenta          text,
  d_tipo_asenta     text,
  d_mnpio           text,
  d_estado          text,
  d_ciudad          text,
  d_cp              text,
  c_estado          text,
  c_oficina         text,
  c_cp              text,
  c_tipo_asenta     text,
  c_mnpio           text,
  id_asenta_cpcons  text,
  d_zona            text,
  c_cve_ciudad      text
);
CREATE INDEX IF NOT EXISTS ix_cp_codigo ON codigos_postales (d_codigo);
CREATE INDEX IF NOT EXISTS ix_cp_estado ON codigos_postales (d_estado);

CREATE TABLE IF NOT EXISTS hsp_estados (
  estado_mx   text PRIMARY KEY,
  hsp         numeric(5,2) NOT NULL,
  fuente      text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- set_updated_at() ya existe (0000_init.sql). Trigger idempotente.
DROP TRIGGER IF EXISTS trg_hsp_estados_upd ON hsp_estados;
CREATE TRIGGER trg_hsp_estados_upd BEFORE UPDATE ON hsp_estados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
