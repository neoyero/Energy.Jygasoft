-- 0026_rls.sql
-- Multi-tenant (Fase 2 · RLS). Activa Row-Level Security + política de aislamiento
-- por empresa en las 30 tablas con `empresa_id`.
--
-- Política TRANSICIONAL (permisiva cuando el GUC no está seteado): así la app
-- sigue funcionando igual mientras se migra el acceso a BD a `conTenant` (que fija
-- `SET LOCAL app.empresa_id`). El aislamiento aplica en cuanto un request fija el
-- GUC; el super-admin (app.superadmin='on') ve todas. En el cierre (2G) se
-- endurece a deny-by-default (quitando la rama "GUC IS NULL").
--
-- IMPORTANTE (deploy): para que RLS realmente aplique, el rol de conexión de la app
-- NO debe ser superusuario ni tener BYPASSRLS. Por eso usamos FORCE ROW LEVEL
-- SECURITY (aplica incluso al dueño de la tabla). Idempotente.

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
      USING (
        current_setting('app.empresa_id', true) IS NULL
        OR current_setting('app.superadmin', true) = 'on'
        OR empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.empresa_id', true) IS NULL
        OR current_setting('app.superadmin', true) = 'on'
        OR empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid
      )
    $pol$, t);
  END LOOP;
END
$mt$;
