import { pgTable, uniqueIndex, unique, uuid, text, boolean, timestamp, foreignKey, bigint, index, numeric, jsonb, date, check, integer, inet, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const actividadEstado = pgEnum("actividad_estado", ['pendiente', 'completada', 'cancelada'])
export const actividadTipo = pgEnum("actividad_tipo", ['llamada', 'visita', 'email', 'whatsapp', 'tarea', 'nota', 'reunion'])
export const campanaEstado = pgEnum("campana_estado", ['borrador', 'activa', 'pausada', 'finalizada'])
export const campanaPlataforma = pgEnum("campana_plataforma", ['youtube', 'facebook', 'instagram', 'whatsapp', 'google', 'otro'])
export const cotizacionEstado = pgEnum("cotizacion_estado", ['borrador', 'enviada', 'aceptada', 'rechazada', 'expirada'])
export const documentoTipo = pgEnum("documento_tipo", ['contrato', 'anexo', 'recibo_cfe', 'identificacion', 'csf', 'carta_poder', 'unifilar', 'memoria_calculo', 'cotizacion', 'evidencia', 'cfdi', 'dictamen_uvie', 'otro'])
export const entidadTipo = pgEnum("entidad_tipo", ['lead', 'cliente', 'contacto', 'oportunidad', 'cotizacion', 'proyecto', 'instalacion'])
export const equipoTipo = pgEnum("equipo_tipo", ['panel', 'inversor', 'estructura', 'material_electrico', 'otro'])
export const esquemaCfe = pgEnum("esquema_cfe", ['medicion_neta', 'facturacion_neta', 'venta_total'])
export const instalacionEstado = pgEnum("instalacion_estado", ['planeada', 'en_progreso', 'pausada', 'completada'])
export const leadCanal = pgEnum("lead_canal", ['youtube', 'facebook', 'instagram', 'whatsapp', 'organico', 'directo', 'referido', 'otro'])
export const leadEstado = pgEnum("lead_estado", ['nuevo', 'sin_calificar', 'en_nutricion', 'calificado', 'asignado', 'convertido', 'perdido', 'descartado'])
export const nivelTension = pgEnum("nivel_tension", ['bt_monofasica', 'bt_trifasica', 'mt1', 'mt2'])
export const oportunidadEtapa = pgEnum("oportunidad_etapa", ['calificacion', 'levantamiento', 'propuesta', 'negociacion', 'ganada', 'perdida'])
export const pagoEstado = pgEnum("pago_estado", ['programado', 'pagado', 'vencido', 'cancelado'])
export const proyectoFase = pgEnum("proyecto_fase", ['input_comercial', 'inicio', 'planeacion', 'ejecucion', 'seguimiento', 'cierre', 'garantia'])
export const tipoPersona = pgEnum("tipo_persona", ['pf_residencial', 'pf_actividad_empresarial', 'pm_comercial', 'pm_industrial'])
export const tramiteCfeEstado = pgEnum("tramite_cfe_estado", ['pendiente', 'solicitud_enviada', 'en_revision_cfe', 'estudio_mt', 'oficio_resolutivo', 'contratos_firmados', 'medidor_instalado', 'en_operacion', 'rechazado'])
export const usoInmueble = pgEnum("uso_inmueble", ['residencial', 'comercial', 'mixto', 'industrial'])
export const usuarioRol = pgEnum("usuario_rol", ['admin', 'gerente', 'vendedor', 'preventa', 'ingenieria', 'lider_cuadrilla', 'cuadrilla', 'operaciones', 'finanzas', 'marketing', 'lectura'])


export const usuarios = pgTable("usuarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text().notNull(),
	email: text().notNull(),
	rol: usuarioRol().default('vendedor').notNull(),
	folioVendedor: text("folio_vendedor"),
	telefono: text(),
	passwordHash: text("password_hash"),
	activo: boolean().default(true).notNull(),
	ultimoAcceso: timestamp("ultimo_acceso", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ux_usuarios_email").using("btree", sql`lower(email)`),
	unique("usuarios_folio_vendedor_key").on(table.folioVendedor),
]);

/**
 * Códigos de un solo uso (OTP) para login passwordless por correo.
 * Se guarda solo el hash del código; expira rápido y limita intentos.
 */
export const loginCodes = pgTable("login_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	codeHash: text("code_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	attempts: integer().default(0).notNull(),
	ip: inet(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_login_codes_email").using("btree", sql`lower(email)`, table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
]);

export const cuadrillas = pgTable("cuadrillas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text().notNull(),
	liderId: uuid("lider_id"),
	activa: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.liderId],
			foreignColumns: [usuarios.id],
			name: "cuadrillas_lider_id_fkey"
		}).onDelete("set null"),
]);

export const cuadrillaMiembros = pgTable("cuadrilla_miembros", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "cuadrilla_miembros_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	cuadrillaId: uuid("cuadrilla_id").notNull(),
	usuarioId: uuid("usuario_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cuadrillaId],
			foreignColumns: [cuadrillas.id],
			name: "cuadrilla_miembros_cuadrilla_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuarios.id],
			name: "cuadrilla_miembros_usuario_id_fkey"
		}).onDelete("cascade"),
	unique("cuadrilla_miembros_cuadrilla_id_usuario_id_key").on(table.usuarioId, table.cuadrillaId),
]);

export const catalogoEquipos = pgTable("catalogo_equipos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tipo: equipoTipo().notNull(),
	marca: text(),
	modelo: text(),
	potenciaWp: numeric("potencia_wp", { precision: 10, scale:  2 }),
	certificacion: text(),
	precio: numeric({ precision: 14, scale:  2 }),
	moneda: text().default('MXN'),
	specs: jsonb().default({}).notNull(),
	proveedor: text(),
	disponible: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_catalogo_tipo").using("btree", table.tipo.asc().nullsLast().op("enum_ops")),
]);

export const hspZonas = pgTable("hsp_zonas", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "hsp_zonas_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	municipio: text().notNull(),
	estadoMx: text("estado_mx").default('Aguascalientes').notNull(),
	cpPrefijo: text("cp_prefijo"),
	hsp: numeric({ precision: 5, scale:  2 }).notNull(),
	tarifaDefault: text("tarifa_default"),
	vigente: boolean().default(true).notNull(),
}, (table) => [
	unique("hsp_zonas_estado_mx_municipio_key").on(table.municipio, table.estadoMx),
]);

export const campanas = pgTable("campanas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text().notNull(),
	plataforma: campanaPlataforma().notNull(),
	segmento: text(),
	zona: text(),
	objetivo: text(),
	presupuesto: numeric({ precision: 14, scale:  2 }),
	moneda: text().default('MXN'),
	utmCampaign: text("utm_campaign"),
	estado: campanaEstado().default('borrador').notNull(),
	fechaInicio: date("fecha_inicio"),
	fechaFin: date("fecha_fin"),
	metricas: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_campanas_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
]);

export const leads = pgTable("leads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	nombre: text(),
	email: text(),
	telefono: text(),
	segmento: text(),
	uso: usoInmueble(),
	cp: text(),
	colonia: text(),
	municipio: text(),
	estadoMx: text("estado_mx").default('Aguascalientes'),
	consumoKwhMes: numeric("consumo_kwh_mes", { precision: 10, scale:  2 }),
	reciboMxn: numeric("recibo_mxn", { precision: 12, scale:  2 }),
	reciboUrl: text("recibo_url"),
	esTitular: boolean("es_titular"),
	esPropietario: boolean("es_propietario"),
	canal: leadCanal().default('directo'),
	campanaId: uuid("campana_id"),
	utm: jsonb().default({}).notNull(),
	landingUrl: text("landing_url"),
	referrer: text(),
	score: integer().default(0).notNull(),
	estado: leadEstado().default('nuevo').notNull(),
	vendedorId: uuid("vendedor_id"),
	sizingKwp: numeric("sizing_kwp", { precision: 10, scale:  2 }),
	sizingPaneles: integer("sizing_paneles"),
	inversionMin: numeric("inversion_min", { precision: 12, scale:  2 }),
	inversionMax: numeric("inversion_max", { precision: 12, scale:  2 }),
	ahorroEstimadoMxn: numeric("ahorro_estimado_mxn", { precision: 12, scale:  2 }),
	rangoComunicado: boolean("rango_comunicado").default(false).notNull(),
	rangoRechazado: boolean("rango_rechazado").default(false).notNull(),
	intencionAgenda: boolean("intencion_agenda").default(false).notNull(),
	consentimientoDatos: boolean("consentimiento_datos").default(false).notNull(),
	consentimientoMarketing: boolean("consentimiento_marketing").default(false).notNull(),
	origenForm: text("origen_form"),
	motivoDescarte: text("motivo_descarte"),
	notas: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	calificadoAt: timestamp("calificado_at", { withTimezone: true, mode: 'string' }),
	asignadoAt: timestamp("asignado_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ix_leads_campana").using("btree", table.campanaId.asc().nullsLast().op("uuid_ops")),
	index("ix_leads_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("ix_leads_email").using("btree", sql`lower(email)`),
	index("ix_leads_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
	index("ix_leads_telefono").using("btree", table.telefono.asc().nullsLast().op("text_ops")),
	index("ix_leads_utm_gin").using("gin", table.utm.asc().nullsLast().op("jsonb_ops")),
	index("ix_leads_vendedor").using("btree", table.vendedorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.campanaId],
			foreignColumns: [campanas.id],
			name: "leads_campana_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.vendedorId],
			foreignColumns: [usuarios.id],
			name: "leads_vendedor_id_fkey"
		}).onDelete("set null"),
	check("leads_segmento_check", sql`segmento = ANY (ARRAY['residencial'::text, 'negocio'::text])`),
]);

export const clientes = pgTable("clientes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tipoPersona: tipoPersona("tipo_persona").notNull(),
	nombre: text().notNull(),
	rfc: text(),
	curp: text(),
	regimenFiscal: text("regimen_fiscal"),
	csfActualizadaAt: date("csf_actualizada_at"),
	email: text(),
	telefono: text(),
	domicilio: text(),
	municipio: text(),
	estadoMx: text("estado_mx").default('Aguascalientes'),
	cp: text(),
	numeroServicioCfe: text("numero_servicio_cfe"),
	tarifa: text(),
	nivelTension: nivelTension("nivel_tension"),
	titularCfe: text("titular_cfe"),
	titularCoincide: boolean("titular_coincide"),
	vendedorId: uuid("vendedor_id"),
	leadOrigenId: uuid("lead_origen_id"),
	notas: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_clientes_rfc").using("btree", table.rfc.asc().nullsLast().op("text_ops")),
	index("ix_clientes_vendedor").using("btree", table.vendedorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.vendedorId],
			foreignColumns: [usuarios.id],
			name: "clientes_vendedor_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.leadOrigenId],
			foreignColumns: [leads.id],
			name: "clientes_lead_origen_id_fkey"
		}).onDelete("set null"),
]);

export const contactos = pgTable("contactos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clienteId: uuid("cliente_id").notNull(),
	nombre: text().notNull(),
	cargo: text(),
	email: text(),
	telefono: text(),
	esPrincipal: boolean("es_principal").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_contactos_cliente").using("btree", table.clienteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.clienteId],
			foreignColumns: [clientes.id],
			name: "contactos_cliente_id_fkey"
		}).onDelete("cascade"),
]);

export const oportunidades = pgTable("oportunidades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clienteId: uuid("cliente_id"),
	leadId: uuid("lead_id"),
	vendedorId: uuid("vendedor_id"),
	nombre: text().notNull(),
	etapa: oportunidadEtapa().default('calificacion').notNull(),
	capacidadKwp: numeric("capacidad_kwp", { precision: 10, scale:  2 }),
	montoEstimado: numeric("monto_estimado", { precision: 14, scale:  2 }),
	moneda: text().default('MXN'),
	probabilidad: integer().default(30),
	fechaCierreEstimada: date("fecha_cierre_estimada"),
	motivoPerdida: text("motivo_perdida"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cerradaAt: timestamp("cerrada_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ix_oport_cliente").using("btree", table.clienteId.asc().nullsLast().op("uuid_ops")),
	index("ix_oport_etapa").using("btree", table.etapa.asc().nullsLast().op("enum_ops")),
	index("ix_oport_vendedor").using("btree", table.vendedorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.clienteId],
			foreignColumns: [clientes.id],
			name: "oportunidades_cliente_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "oportunidades_lead_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.vendedorId],
			foreignColumns: [usuarios.id],
			name: "oportunidades_vendedor_id_fkey"
		}).onDelete("set null"),
	check("oportunidades_probabilidad_check", sql`(probabilidad >= 0) AND (probabilidad <= 100)`),
]);

export const cotizaciones = pgTable("cotizaciones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	oportunidadId: uuid("oportunidad_id"),
	clienteId: uuid("cliente_id"),
	vendedorId: uuid("vendedor_id"),
	folio: text(),
	version: integer().default(1).notNull(),
	capacidadKwp: numeric("capacidad_kwp", { precision: 10, scale:  2 }),
	paneles: integer(),
	inversor: text(),
	subtotal: numeric({ precision: 14, scale:  2 }),
	iva: numeric({ precision: 14, scale:  2 }),
	total: numeric({ precision: 14, scale:  2 }),
	moneda: text().default('MXN'),
	produccionAnualKwh: numeric("produccion_anual_kwh", { precision: 12, scale:  2 }),
	ahorroAnualMxn: numeric("ahorro_anual_mxn", { precision: 12, scale:  2 }),
	paybackAnios: numeric("payback_anios", { precision: 6, scale:  2 }),
	esquema: esquemaCfe(),
	estado: cotizacionEstado().default('borrador').notNull(),
	validaHasta: date("valida_hasta"),
	pdfUrl: text("pdf_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_cotiz_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
	index("ix_cotiz_oport").using("btree", table.oportunidadId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.oportunidadId],
			foreignColumns: [oportunidades.id],
			name: "cotizaciones_oportunidad_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.clienteId],
			foreignColumns: [clientes.id],
			name: "cotizaciones_cliente_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.vendedorId],
			foreignColumns: [usuarios.id],
			name: "cotizaciones_vendedor_id_fkey"
		}).onDelete("set null"),
	unique("cotizaciones_folio_key").on(table.folio),
]);

export const cotizacionItems = pgTable("cotizacion_items", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "cotizacion_items_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	cotizacionId: uuid("cotizacion_id").notNull(),
	equipoId: uuid("equipo_id"),
	descripcion: text().notNull(),
	cantidad: numeric({ precision: 12, scale:  2 }).default('1').notNull(),
	precioUnitario: numeric("precio_unitario", { precision: 14, scale:  2 }).default('0').notNull(),
	importe: numeric({ precision: 14, scale:  2 }).generatedAlwaysAs(sql`(cantidad * precio_unitario)`),
}, (table) => [
	index("ix_cotiz_items_cotiz").using("btree", table.cotizacionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cotizacionId],
			foreignColumns: [cotizaciones.id],
			name: "cotizacion_items_cotizacion_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.equipoId],
			foreignColumns: [catalogoEquipos.id],
			name: "cotizacion_items_equipo_id_fkey"
		}).onDelete("set null"),
]);

export const proyectos = pgTable("proyectos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clienteId: uuid("cliente_id"),
	oportunidadId: uuid("oportunidad_id"),
	vendedorId: uuid("vendedor_id"),
	folio: text(),
	anio: integer().notNull(),
	carpetaPath: text("carpeta_path"),
	tipoPersona: tipoPersona("tipo_persona"),
	capacidadKwp: numeric("capacidad_kwp", { precision: 10, scale:  2 }),
	nivelTension: nivelTension("nivel_tension"),
	tarifa: text(),
	esquema: esquemaCfe(),
	uvieRequerido: boolean("uvie_requerido").default(false),
	fase: proyectoFase().default('input_comercial').notNull(),
	precioSinIva: numeric("precio_sin_iva", { precision: 14, scale:  2 }),
	totalConIva: numeric("total_con_iva", { precision: 14, scale:  2 }),
	costoTotal: numeric("costo_total", { precision: 14, scale:  2 }),
	margenReal: numeric("margen_real", { precision: 14, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cierreAt: timestamp("cierre_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ix_proy_anio").using("btree", table.anio.asc().nullsLast().op("int4_ops")),
	index("ix_proy_cliente").using("btree", table.clienteId.asc().nullsLast().op("uuid_ops")),
	index("ix_proy_fase").using("btree", table.fase.asc().nullsLast().op("enum_ops")),
	index("ix_proy_vendedor").using("btree", table.vendedorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.clienteId],
			foreignColumns: [clientes.id],
			name: "proyectos_cliente_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.oportunidadId],
			foreignColumns: [oportunidades.id],
			name: "proyectos_oportunidad_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.vendedorId],
			foreignColumns: [usuarios.id],
			name: "proyectos_vendedor_id_fkey"
		}).onDelete("set null"),
	unique("proyectos_folio_key").on(table.folio),
]);

export const tramitesCfe = pgTable("tramites_cfe", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proyectoId: uuid("proyecto_id").notNull(),
	estado: tramiteCfeEstado().default('pendiente').notNull(),
	folioCfe: text("folio_cfe"),
	esquema: esquemaCfe(),
	estudioRequerido: boolean("estudio_requerido").default(false),
	fechaSolicitud: date("fecha_solicitud"),
	fechaOficio: date("fecha_oficio"),
	fechaMedidor: date("fecha_medidor"),
	fechaOperacion: date("fecha_operacion"),
	observaciones: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_tramite_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
	index("ix_tramite_proy").using("btree", table.proyectoId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.proyectoId],
			foreignColumns: [proyectos.id],
			name: "tramites_cfe_proyecto_id_fkey"
		}).onDelete("cascade"),
]);

export const instalaciones = pgTable("instalaciones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proyectoId: uuid("proyecto_id").notNull(),
	cuadrillaId: uuid("cuadrilla_id"),
	estado: instalacionEstado().default('planeada').notNull(),
	fechaInicio: date("fecha_inicio"),
	fechaFin: date("fecha_fin"),
	avancePct: integer("avance_pct").default(0),
	notas: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_inst_proy").using("btree", table.proyectoId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.proyectoId],
			foreignColumns: [proyectos.id],
			name: "instalaciones_proyecto_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.cuadrillaId],
			foreignColumns: [cuadrillas.id],
			name: "instalaciones_cuadrilla_id_fkey"
		}).onDelete("set null"),
	check("instalaciones_avance_pct_check", sql`(avance_pct >= 0) AND (avance_pct <= 100)`),
]);

export const proyectoMateriales = pgTable("proyecto_materiales", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "proyecto_materiales_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	proyectoId: uuid("proyecto_id").notNull(),
	equipoId: uuid("equipo_id"),
	descripcion: text().notNull(),
	cantidad: numeric({ precision: 12, scale:  2 }).default('1').notNull(),
	precioUnitario: numeric("precio_unitario", { precision: 14, scale:  2 }).default('0'),
	entregado: boolean().default(false).notNull(),
}, (table) => [
	index("ix_proy_mat_proy").using("btree", table.proyectoId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.proyectoId],
			foreignColumns: [proyectos.id],
			name: "proyecto_materiales_proyecto_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.equipoId],
			foreignColumns: [catalogoEquipos.id],
			name: "proyecto_materiales_equipo_id_fkey"
		}).onDelete("set null"),
]);

export const pagos = pgTable("pagos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	proyectoId: uuid("proyecto_id"),
	cotizacionId: uuid("cotizacion_id"),
	concepto: text().notNull(),
	monto: numeric({ precision: 14, scale:  2 }).notNull(),
	moneda: text().default('MXN'),
	estado: pagoEstado().default('programado').notNull(),
	fechaProgramada: date("fecha_programada"),
	fechaPagada: date("fecha_pagada"),
	metodo: text(),
	cfdiUuid: text("cfdi_uuid"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_pagos_estado").using("btree", table.estado.asc().nullsLast().op("enum_ops")),
	index("ix_pagos_proy").using("btree", table.proyectoId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.proyectoId],
			foreignColumns: [proyectos.id],
			name: "pagos_proyecto_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.cotizacionId],
			foreignColumns: [cotizaciones.id],
			name: "pagos_cotizacion_id_fkey"
		}).onDelete("set null"),
]);

export const actividades = pgTable("actividades", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "actividades_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	tipo: actividadTipo().default('tarea').notNull(),
	titulo: text().notNull(),
	descripcion: text(),
	entidadTipo: entidadTipo("entidad_tipo"),
	entidadId: uuid("entidad_id"),
	asignadoA: uuid("asignado_a"),
	estado: actividadEstado().default('pendiente').notNull(),
	venceAt: timestamp("vence_at", { withTimezone: true, mode: 'string' }),
	completadoAt: timestamp("completado_at", { withTimezone: true, mode: 'string' }),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_act_asignado").using("btree", table.asignadoA.asc().nullsLast().op("uuid_ops"), table.estado.asc().nullsLast().op("uuid_ops")),
	index("ix_act_entidad").using("btree", table.entidadTipo.asc().nullsLast().op("enum_ops"), table.entidadId.asc().nullsLast().op("enum_ops")),
	index("ix_act_vence").using("btree", table.venceAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.asignadoA],
			foreignColumns: [usuarios.id],
			name: "actividades_asignado_a_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [usuarios.id],
			name: "actividades_created_by_fkey"
		}).onDelete("set null"),
]);

export const eventos = pgTable("eventos", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "eventos_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	entidadTipo: entidadTipo("entidad_tipo").notNull(),
	entidadId: uuid("entidad_id").notNull(),
	tipo: text().notNull(),
	descripcion: text(),
	payload: jsonb().default({}).notNull(),
	actor: text().default('sistema').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_eventos_entidad").using("btree", table.entidadTipo.asc().nullsLast().op("timestamptz_ops"), table.entidadId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const documentos = pgTable("documentos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	entidadTipo: entidadTipo("entidad_tipo").notNull(),
	entidadId: uuid("entidad_id").notNull(),
	tipo: documentoTipo().default('otro').notNull(),
	nombre: text().notNull(),
	url: text().notNull(),
	fase: proyectoFase(),
	subidoPor: uuid("subido_por"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_docs_entidad").using("btree", table.entidadTipo.asc().nullsLast().op("uuid_ops"), table.entidadId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.subidoPor],
			foreignColumns: [usuarios.id],
			name: "documentos_subido_por_fkey"
		}).onDelete("set null"),
]);

export const calculadoraSimulaciones = pgTable("calculadora_simulaciones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	leadId: uuid("lead_id"),
	cp: text(),
	segmento: text(),
	tarifa: text(),
	reciboMxn: numeric("recibo_mxn", { precision: 12, scale:  2 }),
	consumoKwh: numeric("consumo_kwh", { precision: 10, scale:  2 }),
	hsp: numeric({ precision: 5, scale:  2 }),
	pr: numeric({ precision: 4, scale:  3 }).default('0.770'),
	kwpSugerido: numeric("kwp_sugerido", { precision: 10, scale:  2 }),
	paneles: integer(),
	produccionAnualKwh: numeric("produccion_anual_kwh", { precision: 12, scale:  2 }),
	inversionMin: numeric("inversion_min", { precision: 12, scale:  2 }),
	inversionMax: numeric("inversion_max", { precision: 12, scale:  2 }),
	ahorroAnualMxn: numeric("ahorro_anual_mxn", { precision: 12, scale:  2 }),
	paybackAnios: numeric("payback_anios", { precision: 6, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_calc_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "calculadora_simulaciones_lead_id_fkey"
		}).onDelete("set null"),
]);

export const formSubmissions = pgTable("form_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	form: text().notNull(),
	payload: jsonb().notNull(),
	leadId: uuid("lead_id"),
	ip: inet(),
	userAgent: text("user_agent"),
	requestId: text("request_id"),
	estado: text().default('recibido').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_form_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "form_submissions_lead_id_fkey"
		}).onDelete("set null"),
	unique("form_submissions_request_id_key").on(table.requestId),
]);

export const webhookLog = pgTable("webhook_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	direccion: text().notNull(),
	evento: text().notNull(),
	payload: jsonb().default({}).notNull(),
	statusCode: integer("status_code"),
	ok: boolean(),
	requestId: text("request_id"),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_webhook_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	check("webhook_log_direccion_check", sql`direccion = ANY (ARRAY['saliente'::text, 'entrante'::text])`),
]);

export const configParametros = pgTable("config_parametros", {
	clave: text().primaryKey().notNull(),
	valor: numeric(),
	valorTexto: text("valor_texto"),
	unidad: text(),
	descripcion: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

/**
 * Catálogo Nacional de Códigos Postales (SEPOMEX / Correos de México).
 * Una fila por asentamiento (colonia). Datos de referencia: se recargan
 * por completo con `pnpm db:import-cp` (TRUNCATE + carga desde los .xlsx).
 */
export const codigosPostales = pgTable("codigos_postales", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "codigos_postales_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	dCodigo: text("d_codigo").notNull(),
	dAsenta: text("d_asenta"),
	dTipoAsenta: text("d_tipo_asenta"),
	dMnpio: text("d_mnpio"),
	dEstado: text("d_estado"),
	dCiudad: text("d_ciudad"),
	dCp: text("d_cp"),
	cEstado: text("c_estado"),
	cOficina: text("c_oficina"),
	cCp: text("c_cp"),
	cTipoAsenta: text("c_tipo_asenta"),
	cMnpio: text("c_mnpio"),
	idAsentaCpcons: text("id_asenta_cpcons"),
	dZona: text("d_zona"),
	cCveCiudad: text("c_cve_ciudad"),
}, (table) => [
	index("ix_cp_codigo").using("btree", table.dCodigo.asc().nullsLast().op("text_ops")),
	index("ix_cp_estado").using("btree", table.dEstado.asc().nullsLast().op("text_ops")),
]);

/**
 * HSP (horas sol pico) promedio por estado, para dimensionar la calculadora a
 * nivel nacional. `hsp_zonas` (municipio) tiene prioridad; este es el fallback
 * por estado antes del fallback global (HSP_FALLBACK).
 */
export const hspEstados = pgTable("hsp_estados", {
	estadoMx: text("estado_mx").primaryKey().notNull(),
	hsp: numeric({ precision: 5, scale: 2 }).notNull(),
	fuente: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const tarifasCfe = pgTable("tarifas_cfe", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "tarifas_cfe_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	tarifa: text().notNull(),
	escalon: text(),
	precioKwh: numeric("precio_kwh", { precision: 8, scale:  4 }),
	cargoFijoMxn: numeric("cargo_fijo_mxn", { precision: 10, scale:  2 }),
	region: text(),
	vigenteDesde: date("vigente_desde").notNull(),
	vigenteHasta: date("vigente_hasta"),
	fuente: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_tarifas_vig").using("btree", table.tarifa.asc().nullsLast().op("date_ops"), table.vigenteDesde.desc().nullsFirst().op("date_ops")),
]);

// Asesores: subconjunto de usuarios habilitados para recibir/atender leads.
// Lleva el id de agente de Chatwoot y reglas de ruteo (zonas/segmentos) para el
// reparto automático (round-robin por `asignaciones`). Solo los usuarios con un
// asesor activo y vinculado (usuario_id) pueden asignarse a un lead.
export const asesores = pgTable("asesores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	usuarioId: uuid("usuario_id"),
	nombre: text().notNull(),
	chatwootAgentId: integer("chatwoot_agent_id").notNull(),
	msEmail: text("ms_email"),
	telefono: text(),
	// Municipios o CP que cubre (vacío = todas).
	zonas: text().array().notNull().default(sql`'{}'`),
	// {residencial,negocio} (vacío = ambos).
	segmentos: text().array().notNull().default(sql`'{}'`),
	activo: boolean().default(true).notNull(),
	// Contador para round-robin / balanceo de carga.
	asignaciones: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_asesores_activo").using("btree", table.activo.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.usuarioId],
			foreignColumns: [usuarios.id],
			name: "asesores_usuario_id_fkey"
		}).onDelete("set null"),
]);
