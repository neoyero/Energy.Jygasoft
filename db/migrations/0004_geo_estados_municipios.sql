-- =====================================================================
-- 0004 — Catálogos geográficos: estados → municipios → códigos_postales
-- Normaliza por clave INEGI (c_estado / c_mnpio, 100% pobladas). Relaciona
-- además hsp_estados (→ estados), hsp_zonas (→ municipios) y, de forma opcional
-- (municipio_id NULL-able, backfill best-effort por nombre+estado), leads y
-- clientes.
-- Idempotente: seguro de re-ejecutar.
-- =====================================================================

-- 1) estados (clave INEGI de 2 dígitos) ------------------------------------
CREATE TABLE IF NOT EXISTS estados (
  clave  text PRIMARY KEY,          -- INEGI c_estado, p.ej. '01'
  nombre text NOT NULL UNIQUE
);

INSERT INTO estados (clave, nombre)
SELECT DISTINCT ON (c_estado) c_estado, d_estado
  FROM codigos_postales
 WHERE c_estado IS NOT NULL AND d_estado IS NOT NULL
 ORDER BY c_estado, d_estado
ON CONFLICT (clave) DO NOTHING;

-- 2) municipios (clave INEGI de municipio dentro del estado) ----------------
CREATE TABLE IF NOT EXISTS municipios (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave_estado text NOT NULL REFERENCES estados (clave),
  clave_mnpio  text NOT NULL,       -- INEGI c_mnpio (dentro del estado)
  nombre       text NOT NULL,
  UNIQUE (clave_estado, clave_mnpio)
);

INSERT INTO municipios (clave_estado, clave_mnpio, nombre)
SELECT DISTINCT ON (c_estado, c_mnpio) c_estado, c_mnpio, d_mnpio
  FROM codigos_postales
 WHERE c_estado IS NOT NULL AND c_mnpio IS NOT NULL AND d_mnpio IS NOT NULL
 ORDER BY c_estado, c_mnpio, d_mnpio
ON CONFLICT (clave_estado, clave_mnpio) DO NOTHING;

-- 3) codigos_postales → municipios (FK compuesta por clave) -----------------
CREATE INDEX IF NOT EXISTS ix_cp_municipio ON codigos_postales (c_estado, c_mnpio);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'codigos_postales_municipio_fkey') THEN
    ALTER TABLE codigos_postales
      ADD CONSTRAINT codigos_postales_municipio_fkey
      FOREIGN KEY (c_estado, c_mnpio) REFERENCES municipios (clave_estado, clave_mnpio);
  END IF;
END $$;

-- 4) hsp_estados → estados (por clave; los nombres coinciden 1:1) -----------
ALTER TABLE hsp_estados ADD COLUMN IF NOT EXISTS estado_clave text;
UPDATE hsp_estados h
   SET estado_clave = e.clave
  FROM estados e
 WHERE e.nombre = h.estado_mx
   AND h.estado_clave IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hsp_estados_estado_fkey') THEN
    ALTER TABLE hsp_estados
      ADD CONSTRAINT hsp_estados_estado_fkey
      FOREIGN KEY (estado_clave) REFERENCES estados (clave);
  END IF;
END $$;

-- 5) hsp_zonas → municipios (override de HSP por municipio) -----------------
ALTER TABLE hsp_zonas ADD COLUMN IF NOT EXISTS municipio_id bigint;
UPDATE hsp_zonas z
   SET municipio_id = m.id
  FROM municipios m
  JOIN estados e ON e.clave = m.clave_estado
 WHERE m.nombre = z.municipio
   AND e.nombre = z.estado_mx
   AND z.municipio_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hsp_zonas_municipio_fkey') THEN
    ALTER TABLE hsp_zonas
      ADD CONSTRAINT hsp_zonas_municipio_fkey
      FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6) leads y clientes → municipios (opcional, NULL-able) --------------------
ALTER TABLE leads    ADD COLUMN IF NOT EXISTS municipio_id bigint;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS municipio_id bigint;

UPDATE leads l
   SET municipio_id = m.id
  FROM municipios m
  JOIN estados e ON e.clave = m.clave_estado
 WHERE m.nombre = l.municipio
   AND e.nombre = l.estado_mx
   AND l.municipio IS NOT NULL
   AND l.municipio_id IS NULL;

UPDATE clientes c
   SET municipio_id = m.id
  FROM municipios m
  JOIN estados e ON e.clave = m.clave_estado
 WHERE m.nombre = c.municipio
   AND e.nombre = c.estado_mx
   AND c.municipio IS NOT NULL
   AND c.municipio_id IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_municipio_fkey') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_municipio_fkey
      FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_municipio_fkey') THEN
    ALTER TABLE clientes ADD CONSTRAINT clientes_municipio_fkey
      FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_leads_municipio    ON leads (municipio_id);
CREATE INDEX IF NOT EXISTS ix_clientes_municipio ON clientes (municipio_id);
