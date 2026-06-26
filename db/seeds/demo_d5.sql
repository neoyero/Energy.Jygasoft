-- =====================================================================
-- SEED DEMO (solo LOCAL/desarrollo) — datos de prueba para recorrer todos los
-- módulos del panel (Leads, Pipeline, Clientes, Cotizaciones, Proyectos,
-- Pagos, Métricas). Idempotente: UUIDs fijos + ON CONFLICT DO NOTHING; las
-- tablas con id bigint se reescriben por entidad padre.
--
-- Todos los registros llevan folios/nombres con "DEMO" para identificarlos.
-- Aplicar:  pnpm db:apply-sql db/seeds/demo_d5.sql
-- Limpiar:  pnpm db:apply-sql db/seeds/demo_d5_clean.sql
-- =====================================================================

BEGIN;

-- Usuario vendedor demo + asesor (para asignación de leads) ----------------
INSERT INTO usuarios (id, nombre, email, rol, activo)
VALUES ('d0000000-0000-4000-8000-000000000002', 'Demo Vendedor', 'demo.vendedor@jygasoft.com', 'vendedor', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO asesores (id, usuario_id, nombre, chatwoot_agent_id, segmentos, activo)
VALUES ('d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', 'Demo Vendedor', 9001, '{residencial,negocio}', true)
ON CONFLICT (id) DO NOTHING;

-- Cuadrilla demo (para instalación) ----------------------------------------
INSERT INTO cuadrillas (id, nombre, lider_id, activa)
VALUES ('d0000000-0000-4000-8000-000000000003', 'Cuadrilla Demo', 'd0000000-0000-4000-8000-000000000002', true)
ON CONFLICT (id) DO NOTHING;

-- Cliente demo (enlazado a municipio Aguascalientes) -----------------------
INSERT INTO clientes (id, tipo_persona, nombre, email, telefono, municipio, estado_mx, cp, vendedor_id, municipio_id)
VALUES ('d0000000-0000-4000-8000-000000000001', 'pf_residencial', 'María González (DEMO)',
        'maria.demo@example.com', '4491112233', 'Aguascalientes', 'Aguascalientes', '20000',
        'd0000000-0000-4000-8000-000000000002',
        (SELECT id FROM municipios WHERE clave_estado='01' AND clave_mnpio='001'))
ON CONFLICT (id) DO NOTHING;

-- Leads demo (varios estados/canales para tabla y kanban) ------------------
INSERT INTO leads (id, nombre, email, telefono, segmento, canal, score, estado, vendedor_id, municipio, estado_mx, municipio_id, origen_form)
VALUES
 ('d0000000-0000-4000-8000-000000000060', 'Pedro Ramírez (DEMO)', 'pedro.demo@example.com', '4492223344', 'residencial', 'facebook', 72, 'calificado', 'd0000000-0000-4000-8000-000000000002', 'Jesús María', 'Aguascalientes', (SELECT id FROM municipios WHERE clave_estado='01' AND clave_mnpio='005'), 'alta_manual'),
 ('d0000000-0000-4000-8000-000000000061', 'Comercializadora DEMO', 'ventas.demo@example.com', '4493334455', 'negocio', 'whatsapp', 55, 'asignado', 'd0000000-0000-4000-8000-000000000002', 'Aguascalientes', 'Aguascalientes', (SELECT id FROM municipios WHERE clave_estado='01' AND clave_mnpio='001'), 'alta_manual'),
 ('d0000000-0000-4000-8000-000000000062', 'Laura Méndez (DEMO)', 'laura.demo@example.com', '4494445566', 'residencial', 'organico', 38, 'nuevo', NULL, 'Calvillo', 'Aguascalientes', (SELECT id FROM municipios WHERE clave_estado='01' AND clave_mnpio='003'), 'alta_manual')
ON CONFLICT (id) DO NOTHING;

-- Oportunidades demo (pipeline + conversión en métricas) -------------------
INSERT INTO oportunidades (id, cliente_id, vendedor_id, nombre, etapa, capacidad_kwp, monto_estimado, probabilidad)
VALUES
 ('d0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'Oportunidad DEMO — Residencial 5 kWp', 'propuesta', 5.00, 120000, 60),
 ('d0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'Oportunidad DEMO — Negocio 10 kWp', 'ganada', 10.00, 240000, 100)
ON CONFLICT (id) DO NOTHING;

-- Cotización demo ----------------------------------------------------------
INSERT INTO cotizaciones (id, oportunidad_id, cliente_id, vendedor_id, folio, version, capacidad_kwp, paneles, inversor, subtotal, iva, total, esquema, estado, valida_hasta)
VALUES ('d0000000-0000-4000-8000-000000000070', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
        'COT-DEMO-001', 1, 5.00, 9, 'Inversor 5kW', 103448.28, 16551.72, 120000, 'medicion_neta', 'enviada', current_date + 30)
ON CONFLICT (id) DO NOTHING;

DELETE FROM cotizacion_items WHERE cotizacion_id = 'd0000000-0000-4000-8000-000000000070';
INSERT INTO cotizacion_items (cotizacion_id, descripcion, cantidad, precio_unitario) VALUES
 ('d0000000-0000-4000-8000-000000000070', 'Panel solar 550W (DEMO)', 9, 3200),
 ('d0000000-0000-4000-8000-000000000070', 'Inversor 5kW (DEMO)', 1, 18000),
 ('d0000000-0000-4000-8000-000000000070', 'Estructura + instalación (DEMO)', 1, 56648.28);

-- Proyectos demo (dos fases distintas para métricas por fase) --------------
INSERT INTO proyectos (id, cliente_id, oportunidad_id, vendedor_id, folio, anio, tipo_persona, capacidad_kwp, nivel_tension, tarifa, esquema, uvie_requerido, fase, precio_sin_iva, total_con_iva, costo_total, margen_real)
VALUES
 ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002', 'DEMO-2026-001', 2026, 'pf_residencial', 5.00, 'bt_monofasica', '1', 'medicion_neta', false, 'ejecucion', 103448.28, 120000, 85000, 18448.28),
 ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', 'DEMO-2026-002', 2026, 'pm_comercial', 10.00, 'bt_trifasica', 'PDBT', 'medicion_neta', true, 'planeacion', 206896.55, 240000, 175000, 31896.55)
ON CONFLICT (id) DO NOTHING;

-- Trámite CFE (proyecto 1) -------------------------------------------------
INSERT INTO tramites_cfe (id, proyecto_id, estado, folio_cfe, esquema, estudio_requerido, fecha_solicitud, observaciones)
VALUES ('d0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000010', 'en_revision_cfe', 'CFE-DEMO-00123', 'medicion_neta', false, current_date - 20, 'Solicitud DEMO en revisión por CFE.')
ON CONFLICT (id) DO NOTHING;

-- Instalación (proyecto 1) -------------------------------------------------
INSERT INTO instalaciones (id, proyecto_id, cuadrilla_id, estado, fecha_inicio, avance_pct, notas)
VALUES ('d0000000-0000-4000-8000-000000000030', 'd0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000003', 'en_progreso', current_date - 5, 60, 'Montaje de estructura y paneles al 60% (DEMO).')
ON CONFLICT (id) DO NOTHING;

-- Materiales (proyecto 1) — bigint id: reescribir por proyecto -------------
DELETE FROM proyecto_materiales WHERE proyecto_id IN ('d0000000-0000-4000-8000-000000000010','d0000000-0000-4000-8000-000000000011');
INSERT INTO proyecto_materiales (proyecto_id, descripcion, cantidad, precio_unitario, entregado) VALUES
 ('d0000000-0000-4000-8000-000000000010', 'Panel solar 550W (DEMO)', 9, 3200, true),
 ('d0000000-0000-4000-8000-000000000010', 'Inversor 5kW (DEMO)', 1, 18000, true),
 ('d0000000-0000-4000-8000-000000000010', 'Estructura de montaje (DEMO)', 1, 12000, false);

-- Pagos (proyecto 1: pagado/programado/vencido; proyecto 2: programado) ----
INSERT INTO pagos (id, proyecto_id, concepto, monto, estado, fecha_programada, fecha_pagada, metodo, cfdi_uuid)
VALUES
 ('d0000000-0000-4000-8000-000000000040', 'd0000000-0000-4000-8000-000000000010', 'Anticipo 50% (DEMO)', 60000, 'pagado', current_date - 30, current_date - 2, 'transferencia', 'CFDI-DEMO-0001'),
 ('d0000000-0000-4000-8000-000000000041', 'd0000000-0000-4000-8000-000000000010', 'Pago intermedio (DEMO)', 30000, 'programado', current_date - 5, NULL, NULL, NULL),
 ('d0000000-0000-4000-8000-000000000042', 'd0000000-0000-4000-8000-000000000010', 'Finiquito (DEMO)', 30000, 'programado', current_date + 20, NULL, NULL, NULL),
 ('d0000000-0000-4000-8000-000000000043', 'd0000000-0000-4000-8000-000000000011', 'Anticipo (DEMO)', 120000, 'programado', current_date + 30, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;
