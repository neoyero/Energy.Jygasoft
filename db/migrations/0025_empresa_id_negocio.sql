-- 0025_empresa_id_negocio.sql
-- Multi-tenant (Fase 2 · cimiento): agrega `empresa_id` (NULLABLE, con índice) a
-- todas las tablas de NEGOCIO y hace backfill de lo existente a Jygasoft (la app
-- hoy es mono-tenant). Es NO rompedor: la columna es nullable, así que los INSERT
-- actuales (que aún no la fijan) siguen funcionando. El scoping en escritura, RLS,
-- uniques compuestos y NOT NULL llegan en incrementos posteriores.
--
-- Quedan GLOBALES (sin empresa_id): catálogos nacionales de referencia
-- (codigos_postales, estados, municipios, hsp_zonas, hsp_estados, tarifas_cfe),
-- login_codes, webhook_log e integraciones (infra compartida: 1 Chatwoot / 1 M365).
-- Idempotente.

DO $$
DECLARE
  jyg uuid;
  t   text;
  tablas text[] := ARRAY[
    'areas','cargos',
    'leads','clientes','contactos','oportunidades','cotizaciones','cotizacion_items',
    'proyectos','tramites_cfe','instalaciones','proyecto_materiales','pagos',
    'actividades','eventos','documentos','campanas',
    'cuadrillas','cuadrilla_miembros','asesores',
    'productos','producto_tipos','paquetes','paquete_lineas','marcas',
    'config_parametros','calculadora_simulaciones','form_submissions'
  ];
BEGIN
  SELECT id INTO jyg FROM empresas WHERE nombre_normalizado = 'jygasoft energy';
  IF jyg IS NULL THEN
    RAISE EXCEPTION 'Falta la empresa por defecto (jygasoft energy). Corre 0022 primero.';
  END IF;

  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id)', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS ix_%s_empresa ON %I (empresa_id)', t, t);
    EXECUTE format('UPDATE %I SET empresa_id = %L WHERE empresa_id IS NULL', t, jyg);
  END LOOP;
END $$;
