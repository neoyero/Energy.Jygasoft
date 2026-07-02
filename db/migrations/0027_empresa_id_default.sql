-- 0027_empresa_id_default.sql
-- Multi-tenant (Fase 2). DEFAULT de `empresa_id` = tenant activo (GUC).
--
-- Con RLS activo (0026), el WITH CHECK exige que empresa_id de la fila insertada
-- coincida con `app.empresa_id`. Para no tener que setear empresa_id en cada uno
-- de los ~106 INSERT de la app, damos a la columna un DEFAULT que lee el GUC de
-- la transaccion de tenant (lo fija runWithTenant via SET LOCAL). Asi:
--   - INSERT bajo tenant  -> empresa_id = empresa activa (auto), pasa WITH CHECK.
--   - INSERT sin GUC (seed/scripts) -> DEFAULT NULL (comportamiento previo).
--   - INSERT super-admin (GUC vacio, superadmin='on') -> NULL; debe setear
--     empresa_id explicitamente al crear (selector de empresa activa, 2F).
--
-- Patron estandar de multi-tenant con Postgres RLS. Idempotente.

DO $mt$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'usuarios','roles','areas','cargos',
    'leads','clientes','contactos','oportunidades','cotizaciones','cotizacion_items',
    'proyectos','tramites_cfe','instalaciones','proyecto_materiales','pagos',
    'actividades','eventos','documentos','campanas',
    'cuadrillas','cuadrilla_miembros','asesores',
    'productos','producto_tipos','paquetes','paquete_lineas','marcas',
    'config_parametros','calculadora_simulaciones','form_submissions'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN empresa_id SET DEFAULT nullif(current_setting(''app.empresa_id'', true), '''')::uuid',
      t
    );
  END LOOP;
END
$mt$;
