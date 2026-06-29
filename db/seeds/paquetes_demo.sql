-- =====================================================================
-- Seed demo de Paquetes (idempotente). Crea servicios de catálogo y 3 paquetes
-- de ejemplo con líneas que referencian productos+servicios.
--   pnpm db:apply-sql db/seeds/paquetes_demo.sql
-- =====================================================================

-- 1) Servicios como productos (naturaleza='servicio'), con SKU para idempotencia.
INSERT INTO productos (producto_tipo_id, sku, nombre, naturaleza, unidad, precio_venta, moneda)
SELECT pt.id, v.sku, v.nombre, 'servicio', v.unidad, v.precio, 'MXN'
FROM (VALUES
  ('instalacion', 'SRV-INST', 'Instalación y puesta en marcha', 'sistema', 15000::numeric),
  ('tramite_cfe', 'SRV-CFE',  'Trámite de interconexión CFE',   'tramite', 6000::numeric)
) AS v(clave, sku, nombre, unidad, precio)
JOIN producto_tipos pt ON pt.clave = v.clave
ON CONFLICT (sku) DO NOTHING;

-- 2) Paquetes de ejemplo (idempotente por clave).
INSERT INTO paquetes (nombre, nombre_normalizado, clave, descripcion, segmento, capacidad_kwp)
VALUES
  ('Paquete Residencial 3 kWp', 'paquete residencial 3 kwp', 'demo_res_3kwp',  'Sistema residencial básico',  'residencial', 3),
  ('Paquete Residencial 5 kWp', 'paquete residencial 5 kwp', 'demo_res_5kwp',  'Sistema residencial medio',   'residencial', 5),
  ('Paquete Comercial 10 kWp',  'paquete comercial 10 kwp',  'demo_com_10kwp', 'Sistema comercial 10 kWp',    'comercial',   10)
ON CONFLICT (clave) DO NOTHING;

-- 3) Líneas: solo para paquetes que aún no tienen líneas (idempotente). Cada
--    línea resuelve el producto más barato del tipo indicado (o por SKU para los
--    servicios) y snapshotea su precio_venta como precio_fijo.
INSERT INTO paquete_lineas (paquete_id, producto_id, descripcion, cantidad, precio_fijo, orden)
SELECT pq.id, pr.id, pr.nombre, v.cantidad, COALESCE(pr.precio_venta, 0), v.orden
FROM (VALUES
  ('demo_res_3kwp', 'panel',               5, 0),
  ('demo_res_3kwp', 'inversor',            1, 1),
  ('demo_res_3kwp', 'estructura',          5, 2),
  ('demo_res_3kwp', 'material_electrico',  1, 3),
  ('demo_res_3kwp', '__sku:SRV-INST',      1, 4),
  ('demo_res_3kwp', '__sku:SRV-CFE',       1, 5),
  ('demo_res_5kwp', 'panel',               9, 0),
  ('demo_res_5kwp', 'inversor',            1, 1),
  ('demo_res_5kwp', 'estructura',          9, 2),
  ('demo_res_5kwp', 'material_electrico',  1, 3),
  ('demo_res_5kwp', '__sku:SRV-INST',      1, 4),
  ('demo_res_5kwp', '__sku:SRV-CFE',       1, 5),
  ('demo_com_10kwp','panel',              17, 0),
  ('demo_com_10kwp','inversor',            2, 1),
  ('demo_com_10kwp','estructura',         17, 2),
  ('demo_com_10kwp','material_electrico',  1, 3),
  ('demo_com_10kwp','__sku:SRV-INST',      1, 4),
  ('demo_com_10kwp','__sku:SRV-CFE',       1, 5)
) AS v(paq_clave, sel, cantidad, orden)
JOIN paquetes pq ON pq.clave = v.paq_clave
JOIN LATERAL (
  SELECT pr.*
  FROM productos pr
  LEFT JOIN producto_tipos t ON t.id = pr.producto_tipo_id
  WHERE pr.activo
    AND (
      (v.sel LIKE '__sku:%' AND pr.sku = substring(v.sel FROM 7))
      OR (v.sel NOT LIKE '__sku:%' AND t.clave = v.sel)
    )
  ORDER BY pr.precio_venta NULLS LAST
  LIMIT 1
) pr ON true
WHERE pr.id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM paquete_lineas pl WHERE pl.paquete_id = pq.id);
