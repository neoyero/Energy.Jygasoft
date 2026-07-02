-- 0022_empresas.sql
-- Multi-tenant (Fase 1): entidad `empresas` (tenant raíz) + `usuarios.empresa_id`.
-- Cada empresa = un dominio de correo (jygasoft.com, sognoterra.com) dentro de la
-- misma organización M365. Idempotente. El aislamiento total (empresa_id en todas
-- las tablas + RLS) llega en una fase posterior.

CREATE TABLE IF NOT EXISTS empresas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  nombre_normalizado text NOT NULL,
  dominio            text NOT NULL,           -- p.ej. jygasoft.com
  rfc                text,
  logo_url           text,
  activa             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_nombre_norm ON empresas (nombre_normalizado);
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_dominio ON empresas (lower(dominio));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_empresas_upd') THEN
    CREATE TRIGGER trg_empresas_upd BEFORE UPDATE ON empresas
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Semilla de empresas (idempotente por nombre_normalizado).
INSERT INTO empresas (nombre, nombre_normalizado, dominio)
SELECT v.n, v.nn, v.d
FROM (VALUES
  ('Jygasoft Energy', 'jygasoft energy', 'jygasoft.com'),
  ('Sognoterra',      'sognoterra',      'sognoterra.com')
) AS v(n, nn, d)
WHERE NOT EXISTS (SELECT 1 FROM empresas e WHERE e.nombre_normalizado = v.nn);

-- usuarios.empresa_id (nullable en esta fase; NOT NULL + RLS en la fase de aislamiento).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_usuarios_empresa ON usuarios (empresa_id);

-- Backfill: por el dominio del correo; el resto cae a Jygasoft (empresa por defecto).
UPDATE usuarios u SET empresa_id = e.id
FROM empresas e
WHERE u.empresa_id IS NULL AND lower(split_part(u.email, '@', 2)) = lower(e.dominio);

UPDATE usuarios u
SET empresa_id = (SELECT id FROM empresas WHERE nombre_normalizado = 'jygasoft energy')
WHERE u.empresa_id IS NULL;
