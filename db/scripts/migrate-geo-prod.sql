-- =====================================================================
-- PRODUCCIÓN — Normalización geográfica: estado → municipio → CP
-- Convierte una BD existente (con codigos_postales ya cargado) al modelo
-- relacional: crea estados/municipios desde las claves INEGI y enlaza
-- codigos_postales, hsp_estados, hsp_zonas, leads y clientes.
--
-- SEGURO: corre dentro de UNA transacción (todo-o-nada) y es IDEMPOTENTE
-- (se puede re-ejecutar). Verifica integridad al final y ABORTA (rollback)
-- si quedaran códigos postales sin municipio.
--
-- Equivale a db/migrations/0004_geo_estados_municipios.sql, endurecido para prod.
--
-- Requisito: codigos_postales debe estar poblado en prod (los maestros se
-- derivan de ahí). Si está vacío, primero corre el import de CPs.
--
-- Uso (en el droplet, recomendado psql):
--   pg_dump "$DATABASE_URL" -Fc -f energydb_pre_geo.dump      # 1) RESPALDO
--   psql "$DATABASE_URL" -f db/scripts/migrate-geo-prod.sql   # 2) APLICAR
-- =====================================================================

BEGIN;

-- Pre-chequeo: avisa si no hay códigos postales (los maestros saldrían vacíos).
DO $$
DECLARE n_cp bigint;
BEGIN
  SELECT count(*) INTO n_cp FROM codigos_postales;
  RAISE NOTICE 'codigos_postales: % filas', n_cp;
  IF n_cp = 0 THEN
    RAISE WARNING 'codigos_postales está vacío: estados/municipios quedarán vacíos. Importa los CPs antes.';
  END IF;
END $$;

-- 1) estados (clave INEGI de 2 dígitos)
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

-- 2) municipios (clave INEGI de municipio dentro del estado)
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

-- 3) codigos_postales → municipios (FK compuesta por clave)
CREATE INDEX IF NOT EXISTS ix_cp_municipio ON codigos_postales (c_estado, c_mnpio);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'codigos_postales_municipio_fkey') THEN
    ALTER TABLE codigos_postales
      ADD CONSTRAINT codigos_postales_municipio_fkey
      FOREIGN KEY (c_estado, c_mnpio) REFERENCES municipios (clave_estado, clave_mnpio);
  END IF;
END $$;

-- 4) hsp_estados → estados (por clave; nombres coinciden 1:1)
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

-- 5) hsp_zonas → municipios (override de HSP por municipio)
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

-- Verificación final: aborta (rollback) si quedaran CPs con clave sin municipio.
DO $$
DECLARE
  n_huerfanos bigint;
  n_est bigint; n_mun bigint;
  n_leads_link bigint; n_cli_link bigint;
BEGIN
  SELECT count(*) INTO n_huerfanos
    FROM codigos_postales cp
   WHERE cp.c_estado IS NOT NULL AND cp.c_mnpio IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM municipios m
        WHERE m.clave_estado = cp.c_estado AND m.clave_mnpio = cp.c_mnpio);
  IF n_huerfanos > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % códigos postales sin municipio (revisa c_estado/c_mnpio).', n_huerfanos;
  END IF;

  SELECT count(*) INTO n_est FROM estados;
  SELECT count(*) INTO n_mun FROM municipios;
  SELECT count(*) INTO n_leads_link FROM leads    WHERE municipio_id IS NOT NULL;
  SELECT count(*) INTO n_cli_link   FROM clientes WHERE municipio_id IS NOT NULL;
  RAISE NOTICE 'OK ✓ estados=%, municipios=%, leads enlazados=%, clientes enlazados=%',
    n_est, n_mun, n_leads_link, n_cli_link;
END $$;

COMMIT;
