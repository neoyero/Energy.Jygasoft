-- =====================================================================
-- Jygasoft Energy — Esquema: SOLO tablas y relaciones (sin índices,
-- triggers ni datos). Para revisión del modelo / diagramas ER.
-- El esquema canónico completo (con índices y triggers) está en
-- SQL/Esquema_BD_Postgres.sql.  PostgreSQL 15+.
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

-- ===================== EQUIPO / PERSONAS / CATÁLOGO =====================
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
  certificacion text,
  precio numeric(14,2), moneda text DEFAULT 'MXN',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  proveedor text,
  disponible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hsp_zonas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  municipio text NOT NULL, estado_mx text NOT NULL DEFAULT 'Aguascalientes',
  cp_prefijo text, hsp numeric(5,2) NOT NULL, tarifa_default text,
  vigente boolean NOT NULL DEFAULT true,
  UNIQUE (estado_mx, municipio)
);

CREATE TABLE hsp_estados (
  estado_mx   text PRIMARY KEY,
  hsp         numeric(5,2) NOT NULL,
  fuente      text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ===================== MARKETING =====================
CREATE TABLE campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  plataforma campana_plataforma NOT NULL,
  segmento text, zona text, objetivo text,
  presupuesto numeric(14,2), moneda text DEFAULT 'MXN',
  utm_campaign text,
  estado campana_estado NOT NULL DEFAULT 'borrador',
  fecha_inicio date, fecha_fin date,
  metricas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- ===================== CLIENTES / CONTACTOS =====================
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_persona tipo_persona NOT NULL,
  nombre text NOT NULL,
  rfc text, curp text,
  regimen_fiscal text, csf_actualizada_at date,
  email text, telefono text,
  domicilio text, municipio text, estado_mx text DEFAULT 'Aguascalientes', cp text,
  numero_servicio_cfe text,
  tarifa text, nivel_tension nivel_tension,
  titular_cfe text, titular_coincide boolean,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  lead_origen_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL, cargo text,
  email text, telefono text,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE cotizacion_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  equipo_id uuid REFERENCES catalogo_equipos(id) ON DELETE SET NULL,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  importe numeric(14,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ===================== PROYECTOS (entrega) =====================
CREATE TABLE proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  oportunidad_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL,
  vendedor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  folio text UNIQUE,
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

CREATE TABLE proyecto_materiales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  equipo_id uuid REFERENCES catalogo_equipos(id) ON DELETE SET NULL,
  descripcion text NOT NULL,
  cantidad numeric(12,2) NOT NULL DEFAULT 1,
  precio_unitario numeric(14,2) DEFAULT 0,
  entregado boolean NOT NULL DEFAULT false
);

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

CREATE TABLE eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad_tipo entidad_tipo NOT NULL, entidad_id uuid NOT NULL,
  tipo text NOT NULL,
  descripcion text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'sistema',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo entidad_tipo NOT NULL, entidad_id uuid NOT NULL,
  tipo documento_tipo NOT NULL DEFAULT 'otro',
  nombre text NOT NULL, url text NOT NULL,
  fase proyecto_fase,
  subido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form text NOT NULL, payload jsonb NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  ip inet, user_agent text,
  request_id text UNIQUE,
  estado text NOT NULL DEFAULT 'recibido',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direccion text NOT NULL CHECK (direccion IN ('saliente','entrante')),
  evento text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code int, ok boolean, request_id text, error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===================== CONFIG / TARIFAS =====================
CREATE TABLE config_parametros (
  clave        text PRIMARY KEY,
  valor        numeric,
  valor_texto  text,
  unidad       text,
  descripcion  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tarifas_cfe (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tarifa         text NOT NULL,
  escalon        text,
  precio_kwh     numeric(8,4),
  cargo_fijo_mxn numeric(10,2),
  region         text,
  vigente_desde  date NOT NULL,
  vigente_hasta  date,
  fuente         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ===================== CÓDIGOS POSTALES (SEPOMEX nacional) =====================
CREATE TABLE codigos_postales (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  d_codigo          text NOT NULL,
  d_asenta          text,
  d_tipo_asenta     text,
  d_mnpio           text,
  d_estado          text,
  d_ciudad          text,
  d_cp              text,
  c_estado          text,
  c_oficina         text,
  c_cp              text,
  c_tipo_asenta     text,
  c_mnpio           text,
  id_asenta_cpcons  text,
  d_zona            text,
  c_cve_ciudad      text
);
