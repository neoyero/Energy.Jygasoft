-- =====================================================================
-- PRODUCCIÓN — Normalización geográfica: estado → municipio → CP
-- Convierte una BD existente (con codigos_postales ya cargado) al modelo
-- relacional: crea estados/municipios desde las claves INEGI y enlaza
-- codigos_postales, hsp_estados, hsp_zonas, leads y clientes.
--
-- SEGURO: corre dentro de UNA transacción (todo-o-nada) y es IDEMPOTENTE.
-- La integridad la impone la FK compuesta de codigos_postales: si hubiera
-- códigos postales con clave sin municipio, el ADD CONSTRAINT falla y TODA
-- la transacción se revierte.
--
-- SIN bloques DO $$ (dollar-quoting): compatible con psql y con clientes SQL
-- que dividen por ';'. La idempotencia se logra con
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT y ADD COLUMN IF NOT EXISTS.
--
-- Requisito: codigos_postales debe estar poblado en prod (los maestros se
-- derivan de ahí). Si está vacío, los maestros quedarán vacíos: importa los
-- CPs antes.
--
-- Uso (en el droplet, recomendado psql):
--   pg_dump "$DATABASE_URL" -Fc -f energydb_pre_geo.dump      -- 1) RESPALDO
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/scripts/migrate-geo-prod.sql
-- =====================================================================

BEGIN;

-- Pre-chequeo informativo (si sale 0, los maestros quedarán vacíos).
SELECT count(*) AS codigos_postales FROM codigos_postales;

-- 1) estados (clave INEGI de 2 dígitos) ------------------------------------
CREATE TABLE IF NOT EXISTS estados (
  clave  text PRIMARY KEY,
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
  clave_mnpio  text NOT NULL,
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
ALTER TABLE codigos_postales DROP CONSTRAINT IF EXISTS codigos_postales_municipio_fkey;
ALTER TABLE codigos_postales ADD  CONSTRAINT codigos_postales_municipio_fkey
  FOREIGN KEY (c_estado, c_mnpio) REFERENCES municipios (clave_estado, clave_mnpio);

-- 4) hsp_estados → estados (por clave; nombres coinciden 1:1) ---------------
ALTER TABLE hsp_estados ADD COLUMN IF NOT EXISTS estado_clave text;
UPDATE hsp_estados h
   SET estado_clave = e.clave
  FROM estados e
 WHERE e.nombre = h.estado_mx
   AND h.estado_clave IS NULL;
ALTER TABLE hsp_estados DROP CONSTRAINT IF EXISTS hsp_estados_estado_fkey;
ALTER TABLE hsp_estados ADD  CONSTRAINT hsp_estados_estado_fkey
  FOREIGN KEY (estado_clave) REFERENCES estados (clave);

-- 5) hsp_zonas → municipios (override de HSP por municipio) -----------------
ALTER TABLE hsp_zonas ADD COLUMN IF NOT EXISTS municipio_id bigint;
UPDATE hsp_zonas z
   SET municipio_id = m.id
  FROM municipios m
  JOIN estados e ON e.clave = m.clave_estado
 WHERE m.nombre = z.municipio
   AND e.nombre = z.estado_mx
   AND z.municipio_id IS NULL;
ALTER TABLE hsp_zonas DROP CONSTRAINT IF EXISTS hsp_zonas_municipio_fkey;
ALTER TABLE hsp_zonas ADD  CONSTRAINT hsp_zonas_municipio_fkey
  FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;

-- 6) leads y clientes → municipios (opcional, NULL-able; backfill best-effort)
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

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_municipio_fkey;
ALTER TABLE leads ADD  CONSTRAINT leads_municipio_fkey
  FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_municipio_fkey;
ALTER TABLE clientes ADD  CONSTRAINT clientes_municipio_fkey
  FOREIGN KEY (municipio_id) REFERENCES municipios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_leads_municipio    ON leads (municipio_id);
CREATE INDEX IF NOT EXISTS ix_clientes_municipio ON clientes (municipio_id);

-- Resumen final (psql lo imprime). Si llegamos aquí, la FK ya validó que no
-- hay códigos postales con clave sin municipio.
SELECT
  (SELECT count(*) FROM estados)                                  AS estados,
  (SELECT count(*) FROM municipios)                               AS municipios,
  (SELECT count(*) FROM leads    WHERE municipio_id IS NOT NULL)  AS leads_enlazados,
  (SELECT count(*) FROM clientes WHERE municipio_id IS NOT NULL)  AS clientes_enlazados;

COMMIT;
