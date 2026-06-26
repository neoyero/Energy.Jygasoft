-- =====================================================================
-- 0005 — Parámetros de costeo para el dimensionamiento de cotizaciones.
-- Constantes editables (config_parametros) usadas por el wizard de Sistema
-- para itemizar las partidas (paneles, estructura, material, protecciones,
-- mano de obra, inversor). El código tiene fallbacks con estos mismos valores.
-- Idempotente.
-- =====================================================================

INSERT INTO config_parametros (clave, valor, unidad, descripcion) VALUES
  ('PRECIO_PANEL_FALLBACK',        3500, 'MXN/pieza', 'Precio por panel si no hay panel en el catálogo'),
  ('PRECIO_ESTRUCTURA_POR_PANEL',   650, 'MXN/panel', 'Costo de estructura de montaje por panel'),
  ('COSTO_MATERIAL_ELEC_POR_KWP',  1800, 'MXN/kWp',   'Cable y material eléctrico por kWp'),
  ('COSTO_PROTECCIONES_POR_KWP',    900, 'MXN/kWp',   'Protecciones (centro de carga, supresores, etc.) por kWp'),
  ('COSTO_MANO_OBRA_POR_KWP',      2500, 'MXN/kWp',   'Mano de obra de instalación por kWp'),
  ('INVERSOR_PRECIO_POR_KWP',      2500, 'MXN/kWp',   'Precio estimado de inversor por kWp (fallback si no hay inversor en catálogo)'),
  ('INVERSOR_SIZING_RATIO',         0.9, 'ratio',     'Relación de dimensionamiento AC/DC del inversor (potencia AC ≈ kWp×ratio)'),
  ('INVERSOR_KW_MAX',                12, 'kW',        'Capacidad máxima por inversor para decidir cantidad')
ON CONFLICT (clave) DO NOTHING;
