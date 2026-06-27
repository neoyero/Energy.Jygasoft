-- =====================================================================
-- 0007 — Re-cableado de FK a productos + retiro de catalogo_equipos.
--
-- Cierra la unificación iniciada en 0006: las FK equipo_id de cotizaciones y
-- materiales de proyecto pasan de catalogo_equipos a productos. Como el backfill
-- de 0006 conservó el mismo id, NO hay datos que ajustar: los equipo_id ya
-- apuntan a filas existentes en productos.
-- Idempotente (DROP CONSTRAINT IF EXISTS antes de cada ADD; DROP TABLE IF EXISTS).
-- =====================================================================

-- Salvaguarda: aborta si quedara algún equipo_id sin su producto correspondiente
-- (no debería ocurrir tras 0006). Mejor fallar ruidosamente que crear huérfanos.
DO $$
DECLARE
  huerfanos_ci int;
  huerfanos_pm int;
BEGIN
  SELECT count(*) INTO huerfanos_ci
  FROM cotizacion_items ci
  WHERE ci.equipo_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = ci.equipo_id);

  SELECT count(*) INTO huerfanos_pm
  FROM proyecto_materiales pm
  WHERE pm.equipo_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM productos p WHERE p.id = pm.equipo_id);

  IF huerfanos_ci > 0 OR huerfanos_pm > 0 THEN
    RAISE EXCEPTION 'Abortado: % equipo_id huérfanos en cotizacion_items y % en proyecto_materiales. Revisa el backfill 0006 antes de re-cablear.',
      huerfanos_ci, huerfanos_pm;
  END IF;
END $$;

-- 1) cotizacion_items.equipo_id -> productos(id)
ALTER TABLE cotizacion_items DROP CONSTRAINT IF EXISTS cotizacion_items_equipo_id_fkey;
ALTER TABLE cotizacion_items
  ADD CONSTRAINT cotizacion_items_equipo_id_fkey
  FOREIGN KEY (equipo_id) REFERENCES productos(id) ON DELETE SET NULL;

-- 2) proyecto_materiales.equipo_id -> productos(id)
ALTER TABLE proyecto_materiales DROP CONSTRAINT IF EXISTS proyecto_materiales_equipo_id_fkey;
ALTER TABLE proyecto_materiales
  ADD CONSTRAINT proyecto_materiales_equipo_id_fkey
  FOREIGN KEY (equipo_id) REFERENCES productos(id) ON DELETE SET NULL;

-- 3) Retira el catálogo viejo (ya migrado a productos). El tipo enum equipo_tipo
--    se conserva (sin usos en tablas) por compatibilidad de tipos.
DROP TABLE IF EXISTS catalogo_equipos;
