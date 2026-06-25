-- =====================================================================
-- Jygasoft Energy — Esquema PostgreSQL (v2 — Mini-CRM)
-- Robusto, ligero y rápido. PostgreSQL 15+.
-- Cubre: ventas (lead→cliente→oportunidad→cotización), entrega (proyecto 00-06,
-- trámite CFE, instalación, materiales), finanzas (pagos), marketing (campañas),
-- actividades/tareas, documentos, timeline unificado e integración n8n.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===================== ENUMS =====================
CREATE TYPE tipo_persona        AS ENUM ('pf_residencial','pf_actividad_empresarial','pm_comercial','pm_industrial');
CREATE TYPE lead_canal          AS ENUM ('youtube','facebook','instagram','whatsapp','organico','directo','referido','otro');
CREATE TYPE lead_estado         AS ENUM ('nuevo','sin_calificar','en_nutricion','calificado','asignado','convertido','perdido','descartado');
CREATE TYPE oportunidad_etapa   AS ENUM ('calificacion','levantamiento','propuesta','negociacion','ganada','perdida');
CREATE TYPE proyecto_fase       AS ENUM ('input_comercial','inicio','planeacion','ejecucion','seguimiento','cierre','garantia');
CREATE TYPE tramite_cfe_estado  AS ENUM ('pendiente','solicitud_enviada','en_revision_cfe','estudio_mt','oficio_resolutivo','contratos_firmados','medidor_instalado','en_operacion','rechazado');
CREATE TYPE esquema_cfe         AS ENUM ('medicion_neta','facturacion_neta','venta_total');
CREATE TYPE nivel_tension       AS ENUM ('bt_monofasica','bt_trifasica','mt1','mt2');
CREATE TYPE uso_inmueble        AS ENUM ('residencial','comercial','mixto','industrial');
CREATE TYPE usuario_rol         AS ENUM ('admin','gerente','vendedor','preventa','ingenieria','lider_cuadrilla','cuadrilla','operaciones','finanzas','marketing','lectura');
CREATE TYPE cotizacion_estado   AS ENUM ('borrador','enviada','aceptada','rechazada','expirada');
CREATE TYPE actividad_tipo      AS ENUM ('llamada','visita','email','whatsapp','tarea','nota','reunion');
CREATE TYPE actividad_estado    AS ENUM ('pendiente','completada','cancelada');
CREATE TYPE documento_tipo      AS ENUM ('contrato','anexo','recibo_cfe','identificacion','csf','carta_poder','unifilar','memoria_calculo','cotizacion','evidencia','cfdi','dictamen_uvie','otro');
CREATE TYPE equipo_tipo         AS ENUM ('panel','inversor','estructura','material_electrico','otro');
CREATE TYPE pago_estado         AS ENUM ('programado','pagado','vencido','cancelado');
CREATE TYPE campana_plataforma  AS ENUM ('youtube','facebook','instagram','whatsapp','google','otro');
CREATE TYPE campana_estado      AS ENUM ('borrador','activa','pausada','finalizada');
CREATE TYPE instalacion_estado  AS ENUM ('planeada','en_progreso','pausada','completada');
CREATE TYPE entidad_tipo        AS ENUM ('lead','cliente','contacto','oportunidad','cotizacion','proyecto','instalacion');

-- ===================== TRIGGER updated_at =====================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ===================== EQUIPO / PERSONAS / CATALOGO =====================
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text NOT NULL,
  rol usuario_rol NOT NULL DEFAULT 'vendedor',
  folio_vendedor text UNIQUE,
  telefono text,
  password_hash text,
  activo boolean NOT NULL DEFAULT true,
  ultimo_acceso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (lower(email));
CREATE TRIGGER trg_usuarios_upd BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Códigos de un solo uso (OTP) para login passwordless por correo (je-admin).
CREATE TABLE login_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_login_codes_email ON login_codes (lower(email), created_at DESC);
CREATE INDEX ix_login_codes_active ON login_codes (lower(email), created_at DESC) WHERE consumed_at IS NULL;

CREATE TABLE cuadrillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  lider_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cuadrilla_miembros (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cuadrilla_id uuid NOT NULL REFERENCES cuadrillas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE (cuadrilla_id, usuario_id)
);

CREATE TABLE catalogo_equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo equipo_tipo NOT NULL,
  marca text, modelo text,
  potencia_wp numeric(10,2),
  certificacion text,                          -- UL1741 / IEEE1547 / IEC
  precio numeric(14,2), moneda text DEFAULT 'MXN',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  proveedor text,
  disponible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_catalogo_tipo ON catalogo_equipos (tipo);
CREATE TRIGGER trg_catalogo_upd BEFORE UPDATE ON catalogo_equipos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE hsp_zonas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  municipio text NOT NULL, estado_mx text NOT NULL DEFAULT 'Aguascalientes',
  cp_prefijo text, hsp numeric(5,2) NOT NULL, tarifa_default text,
  vigente boolean NOT NULL DEFAULT true,
  UNIQUE (estado_mx, municipio)
);

-- ===================== MARKETING =====================
CREATE TABLE campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  plataforma campana_plataforma NOT NULL,
  segmento text,                               -- residencial | comercial | industrial
  zona text,
  objetivo text,
  presupuesto numeric(14,2), moneda text DEFAULT 'MXN',
  utm_campaign text,
  estado campana_estado NOT NULL DEFAULT 'borrador',
  fecha_inicio date, fecha_fin date,
  metricas jsonb NOT NULL DEFAULT '{}'::jsonb,  -- impresiones, clics, gasto, leads...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_campanas_estado ON campanas (estado);
CREATE TRIGGER trg_campanas_upd BEFORE UPDATE ON campanas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================== LEADS =====================
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text, email text, telefono text,
  segmento text CHECK (segmento IN ('residencial','negocio')),
  uso uso_inmueble,
  cp text, colonia text, municipio text, estado_mx text DEFAULT 'Aguascalientes',
  consumo_kwh_mes numeric(10,2), recibo_mxn numeric(12,2), recibo_url text,
  es_titular boolean, es_propietario boolean,
  canal lead_canal DEFAULT 'directo',
  campana_id uuid REFERENCES campanas(id) ON DELETE SET NULL,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  landing_url text, referrer text,
  score int NOT NULL DEFAULT 0,
  estado lead_estado NOT NULL DEFAULT 'nuevo',
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  sizing_kwp numeric(10,2), sizing_paneles int,
  inversion_min numeric(12,2), inversion_max numeric(12,2), ahorro_estimado_mxn numeric(12,2),
  rango_comunicado boolean NOT NULL DEFAULT false,
  rango_rechazado boolean NOT NULL DEFAULT false,
  intencion_agenda boolean NOT NULL DEFAULT false,
  consentimiento_datos boolean NOT NULL DEFAULT false,
  consentimiento_marketing boolean NOT NULL DEFAULT false,
  origen_form text, motivo_descarte text, notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  calificado_at timestamptz, asignado_at timestamptz
);
CREATE INDEX ix_leads_estado ON leads (estado);
CREATE INDEX ix_leads_vendedor ON leads (vendedor_id);
CREATE INDEX ix_leads_created ON leads (created_at DESC);
CREATE INDEX ix_leads_email ON leads (lower(email));
CREATE INDEX ix_leads_telefono ON leads (telefono);
CREATE INDEX ix_leads_campana ON leads (campana_id);
CREATE INDEX ix_leads_utm_gin ON leads USING gin (utm);
CREATE TRIGGER trg_leads_upd BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================== CLIENTES / CONTACTOS =====================
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_persona tipo_persona NOT NULL,
  nombre text NOT NULL,                         -- nombre PF o razón social PM
  rfc text, curp text,
  regimen_fiscal text, csf_actualizada_at date,
  email text, telefono text,
  domicilio text, municipio text, estado_mx text DEFAULT 'Aguascalientes', cp text,
  numero_servicio_cfe text,                     -- RMU
  tarifa text, nivel_tension nivel_tension,
  titular_cfe text, titular_coincide boolean,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  lead_origen_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_clientes_vendedor ON clientes (vendedor_id);
CREATE INDEX ix_clientes_rfc ON clientes (rfc);
CREATE TRIGGER trg_clientes_upd BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL, cargo text,
  email text, telefono text,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_contactos_cliente ON contactos (cliente_id);

-- ===================== OPORTUNIDADES (deals) =====================
CREATE TABLE oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  etapa oportunidad_etapa NOT NULL DEFAULT 'calificacion',
  capacidad_kwp numeric(10,2),
  monto_estimado numeric(14,2), moneda text DEFAULT 'MXN',
  probabilidad int CHECK (probabilidad BETWEEN 0 AND 100) DEFAULT 30,
  fecha_cierre_estimada date,
  motivo_perdida text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cerrada_at timestamptz
);
CREATE INDEX ix_oport_etapa ON oportunidades (etapa);
CREATE INDEX ix_oport_vendedor ON oportunidades (vendedor_id);
CREATE INDEX ix_oport_cliente ON oportunidades (cliente_id);
CREATE TRIGGER trg_oport_upd BEFORE UPDATE ON oportunidades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================== COTIZACIONES =====================
CREATE TABLE cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id uuid REFERENCES oportunidades(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  folio text UNIQUE,
  version int NOT NULL DEFAULT 1,
  capacidad_kwp numeric(10,2), paneles int, inversor text,
  subtotal numeric(14,2), iva numeric(14,2), total numeric(14,2), moneda text DEFAULT 'MXN',
  produccion_anual_kwh numeric(12,2), ahorro_anual_mxn numeric(12,2), payback_anios numeric(6,2),
  esquema esquema_cfe,
  estado cotizacion_estado NOT NULL DEFAULT 'borrador',
  valida_hasta date, pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cotiz_oport ON cotizaciones (oportunidad_id);
CREATE INDEX ix_cotiz_estado ON cotizaciones (estado);
CREATE TRIGGER trg_cotiz_upd BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cotizacion_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  equipo_id uuid REFERENCES catalogo_equipos(id) ON DELETE SET NULL,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  importe numeric(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);
CREATE INDEX ix_cotiz_items_cotiz ON cotizacion_items (cotizacion_id);

-- ===================== PROYECTOS (entrega) =====================
CREATE TABLE proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  oportunidad_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  folio text UNIQUE,                            -- V01-2026-001
  anio int NOT NULL,
  carpeta_path text,
  tipo_persona tipo_persona,
  capacidad_kwp numeric(10,2), nivel_tension nivel_tension, tarifa text,
  esquema esquema_cfe, uvie_requerido boolean DEFAULT false,
  fase proyecto_fase NOT NULL DEFAULT 'input_comercial',
  precio_sin_iva numeric(14,2), total_con_iva numeric(14,2),
  costo_total numeric(14,2), margen_real numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cierre_at timestamptz
);
CREATE INDEX ix_proy_fase ON proyectos (fase);
CREATE INDEX ix_proy_vendedor ON proyectos (vendedor_id);
CREATE INDEX ix_proy_cliente ON proyectos (cliente_id);
CREATE INDEX ix_proy_anio ON proyectos (anio);
CREATE TRIGGER trg_proy_upd BEFORE UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tramites_cfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  estado tramite_cfe_estado NOT NULL DEFAULT 'pendiente',
  folio_cfe text, esquema esquema_cfe,
  estudio_requerido boolean DEFAULT false,
  fecha_solicitud date, fecha_oficio date, fecha_medidor date, fecha_operacion date,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tramite_proy ON tramites_cfe (proyecto_id);
CREATE INDEX ix_tramite_estado ON tramites_cfe (estado);
CREATE TRIGGER trg_tramite_upd BEFORE UPDATE ON tramites_cfe FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE instalaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  cuadrilla_id uuid REFERENCES cuadrillas(id) ON DELETE SET NULL,
  estado instalacion_estado NOT NULL DEFAULT 'planeada',
  fecha_inicio date, fecha_fin date,
  avance_pct int CHECK (avance_pct BETWEEN 0 AND 100) DEFAULT 0,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inst_proy ON instalaciones (proyecto_id);
CREATE TRIGGER trg_inst_upd BEFORE UPDATE ON instalaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE proyecto_materiales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  equipo_id uuid REFERENCES catalogo_equipos(id) ON DELETE SET NULL,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(14,2) DEFAULT 0,
  entregado boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_proy_mat_proy ON proyecto_materiales (proyecto_id);

-- ===================== FINANZAS =====================
CREATE TABLE pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
  cotizacion_id uuid REFERENCES cotizaciones(id) ON DELETE SET NULL,
  concepto text NOT NULL,
  monto numeric(14,2) NOT NULL, moneda text DEFAULT 'MXN',
  estado pago_estado NOT NULL DEFAULT 'programado',
  fecha_programada date, fecha_pagada date,
  metodo text, cfdi_uuid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_pagos_proy ON pagos (proyecto_id);
CREATE INDEX ix_pagos_estado ON pagos (estado);
CREATE TRIGGER trg_pagos_upd BEFORE UPDATE ON pagos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================== ACTIVIDADES / TIMELINE / DOCUMENTOS (polimórficos) =====================
CREATE TABLE actividades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo actividad_tipo NOT NULL DEFAULT 'tarea',
  titulo text NOT NULL, descripcion text,
  entidad_tipo entidad_tipo, entidad_id uuid,
  asignado_a uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  estado actividad_estado NOT NULL DEFAULT 'pendiente',
  vence_at timestamptz, completado_at timestamptz,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_act_entidad ON actividades (entidad_tipo, entidad_id);
CREATE INDEX ix_act_asignado ON actividades (asignado_a, estado);
CREATE INDEX ix_act_vence ON actividades (vence_at);
CREATE TRIGGER trg_act_upd BEFORE UPDATE ON actividades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad_tipo entidad_tipo NOT NULL, entidad_id uuid NOT NULL,
  tipo text NOT NULL,                           -- creado | cambio_estado | nota | nutricion | email | etc.
  descripcion text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'sistema',        -- usuario:<id> | n8n | web | sistema
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_eventos_entidad ON eventos (entidad_tipo, entidad_id, created_at);

CREATE TABLE documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo entidad_tipo NOT NULL, entidad_id uuid NOT NULL,
  tipo documento_tipo NOT NULL DEFAULT 'otro',
  nombre text NOT NULL, url text NOT NULL,
  fase proyecto_fase,
  subido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_docs_entidad ON documentos (entidad_tipo, entidad_id);

-- ===================== CALCULADORA / INTEGRACIÓN =====================
CREATE TABLE calculadora_simulaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  cp text, segmento text, tarifa text,
  recibo_mxn numeric(12,2), consumo_kwh numeric(10,2),
  hsp numeric(5,2), pr numeric(4,3) DEFAULT 0.770,
  kwp_sugerido numeric(10,2), paneles int, produccion_anual_kwh numeric(12,2),
  inversion_min numeric(12,2), inversion_max numeric(12,2),
  ahorro_anual_mxn numeric(12,2), payback_anios numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_calc_created ON calculadora_simulaciones (created_at DESC);

CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form text NOT NULL, payload jsonb NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  ip inet, user_agent text,
  request_id text UNIQUE,
  estado text NOT NULL DEFAULT 'recibido',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_form_created ON form_submissions (created_at DESC);

CREATE TABLE webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direccion text NOT NULL CHECK (direccion IN ('saliente','entrante')),
  evento text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code int, ok boolean, request_id text, error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_webhook_created ON webhook_log (created_at DESC);


-- ===================== CONFIG / TARIFAS (parametrización flexible) =====================
CREATE TABLE config_parametros (
  clave        text PRIMARY KEY,
  valor        numeric,
  valor_texto  text,
  unidad       text,
  descripcion  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_config_upd BEFORE UPDATE ON config_parametros FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tarifas_cfe (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tarifa         text NOT NULL,            -- '1','DAC','PDBT','GDMTH','GDMTO'
  escalon        text,                     -- basico|intermedio|excedente|energia|variable
  precio_kwh     numeric(8,4),
  cargo_fijo_mxn numeric(10,2),
  region         text,                     -- Nacional|Central|Bajio
  vigente_desde  date NOT NULL,
  vigente_hasta  date,
  fuente         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tarifas_vig ON tarifas_cfe (tarifa, vigente_desde DESC);

-- ===================== CÓDIGOS POSTALES (SEPOMEX nacional) =====================
-- Catálogo Nacional de Códigos Postales (Correos de México). Una fila por
-- asentamiento (colonia). Se recarga completo con `pnpm db:import-cp`.
CREATE TABLE codigos_postales (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  d_codigo          text NOT NULL,            -- CP de 5 dígitos
  d_asenta          text,                     -- nombre del asentamiento (colonia)
  d_tipo_asenta     text,                     -- Colonia | Fraccionamiento | Barrio | ...
  d_mnpio           text,                     -- municipio
  d_estado          text,                     -- estado
  d_ciudad          text,
  d_cp              text,                     -- CP de la administración postal
  c_estado          text,                     -- clave de estado (INEGI/SEPOMEX)
  c_oficina         text,
  c_cp              text,
  c_tipo_asenta     text,
  c_mnpio           text,                     -- clave de municipio
  id_asenta_cpcons  text,                     -- id consecutivo del asentamiento
  d_zona            text,                     -- Urbano | Rural
  c_cve_ciudad      text
);
CREATE INDEX ix_cp_codigo ON codigos_postales (d_codigo);
CREATE INDEX ix_cp_estado ON codigos_postales (d_estado);

-- HSP (horas sol pico) promedio por estado: fallback nacional de la calculadora.
-- Prioridad de resolución: hsp_zonas (municipio) > hsp_estados (estado) > HSP_FALLBACK.
CREATE TABLE hsp_estados (
  estado_mx   text PRIMARY KEY,
  hsp         numeric(5,2) NOT NULL,
  fuente      text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_hsp_estados_upd BEFORE UPDATE ON hsp_estados FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Asesores: subconjunto de usuarios habilitados para recibir/atender leads.
-- Lleva el agente de Chatwoot y reglas de ruteo (zonas/segmentos) para el
-- reparto automático (round-robin por `asignaciones`). Solo los usuarios con un
-- asesor activo y vinculado (usuario_id) pueden asignarse a un lead.
CREATE TABLE asesores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  chatwoot_agent_id integer NOT NULL,
  ms_email text,
  telefono text,
  zonas text[] NOT NULL DEFAULT '{}',       -- municipios o CP que cubre (vacío = todas)
  segmentos text[] NOT NULL DEFAULT '{}',    -- {residencial,negocio} (vacío = ambos)
  activo boolean NOT NULL DEFAULT true,
  asignaciones integer NOT NULL DEFAULT 0,   -- contador para round-robin / carga
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_asesores_activo ON asesores (activo);
CREATE TRIGGER trg_asesores_upd BEFORE UPDATE ON asesores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
