import {
  sql,
  desc,
  asc,
  eq,
  and,
  or,
  ilike,
  inArray,
  gte,
  lt,
  isNull,
  count,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";
import { db, schema } from "@/db";
import type { Rol } from "@/lib/admin/rbac";

/** Lecturas del panel (read-side). Las mutaciones van por Server Actions. */

export type LeadRecord = typeof schema.leads.$inferSelect;

/** Uso del inmueble (enum uso_inmueble). */
export type UsoInmueble = (typeof schema.usoInmueble.enumValues)[number];

/**
 * Datos editables de un lead (alta manual / edición). Solo campos capturables
 * por una persona; los derivados (score, sizing, inversión, utm…) se calculan
 * o llegan por integración y no se editan desde este formulario. Los numéricos
 * viajan como string (formato numeric de Postgres) o null.
 */
export interface LeadFormData {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  segmento: "residencial" | "negocio" | null;
  uso: UsoInmueble | null;
  cp: string | null;
  colonia: string | null;
  municipio: string | null;
  estadoMx: string | null;
  consumoKwhMes: string | null;
  reciboMxn: string | null;
  esTitular: boolean | null;
  esPropietario: boolean | null;
  canal: LeadCanal;
  consentimientoDatos: boolean;
  consentimientoMarketing: boolean;
  notas: string | null;
  vendedorId: string | null;
}

/**
 * Lead por id. Compartimentado: un rol scoped (vendedor/preventa) solo accede a
 * un lead de su subárbol; cualquier otro id devuelve null (la página hace
 * notFound()).
 */
export async function getLead(scope: DashboardScope, id: string) {
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .limit(1);
  if (!lead) return null;
  const ambito = await idsEnAmbito(scope);
  if (ambito && (lead.vendedorId == null || !ambito.includes(lead.vendedorId)))
    return null;
  return lead;
}

export async function getLeadTimeline(id: string) {
  return db
    .select()
    .from(schema.eventos)
    .where(
      sql`${schema.eventos.entidadTipo} = 'lead' AND ${schema.eventos.entidadId} = ${id}`,
    )
    .orderBy(desc(schema.eventos.createdAt))
    .limit(100);
}

export async function getUsuarios() {
  const jefe = alias(schema.usuarios, "jefe");
  return db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
      rol: schema.usuarios.rol,
      telefono: schema.usuarios.telefono,
      activo: schema.usuarios.activo,
      cargo: schema.usuarios.cargo,
      reportaA: schema.usuarios.reportaA,
      jefeNombre: jefe.nombre,
      areaId: schema.usuarios.areaId,
      areaNombre: schema.areas.nombre,
      ultimoAcceso: schema.usuarios.ultimoAcceso,
    })
    .from(schema.usuarios)
    .leftJoin(jefe, eq(schema.usuarios.reportaA, jefe.id))
    .leftJoin(schema.areas, eq(schema.usuarios.areaId, schema.areas.id))
    .orderBy(asc(schema.usuarios.nombre))
    .limit(500);
}

/* ─────────────────────────────────────────────────────────────────────────
 * DASHBOARD je-admin — capa de datos
 *
 * Convenciones SQL:
 *  - Montos: coalesce(sum(col),0)::float8  -> number JS.
 *  - Conteos: count(*)::int.
 *  - ids bigint: id::text (evita perdida de precision en JS).
 *  - Scoping (Fase 3): roles 'vendedor' y 'preventa' ven su SUBÁRBOL
 *    (filtro por vendedor_id IN idsEnAmbito = self + descendientes). El resto
 *    (admin/gerente/funcionales) ve global.
 *  - db.execute(sql`…`) devuelve QueryResult; las filas estan en `.rows` y se
 *    tipan como unknown y se estrechan con helpers de narrowing (sin `any`).
 * ──────────────────────────────────────────────────────────────────────── */

export interface DashboardScope {
  rol: Rol;
  userId: string;
}

/**
 * true para roles con vista acotada a su subárbol (vendedor/preventa/gerente).
 * admin queda global (ve todo); el gerente ve a su equipo (su subárbol en la
 * línea de reporte): un gerente sin reportes solo se vería a sí mismo.
 */
export function isScoped(rol: Rol): boolean {
  return rol === "vendedor" || rol === "preventa" || rol === "gerente";
}

/**
 * IDs de vendedor visibles para el scope, según la regla de VISIBILIDAD POR
 * SUBÁRBOL (Fase 3):
 *  - roles acotados (isScoped: vendedor/preventa/gerente): su subárbol = [self,
 *    ...descendientes en la línea de reporte]. Sin reportes solo se ven a sí
 *    mismos; con equipo ven también lo de su gente.
 *  - roles globales (admin/funcionales): `null` = sin filtro (ven todo).
 * Devolver `null` significa "ver todo". Se reutiliza en todas las queries y en
 * los puedeAcceder*; reusa getDescendientes (cycle-safe).
 */
export async function idsEnAmbito(
  scope: DashboardScope,
): Promise<string[] | null> {
  if (!isScoped(scope.rol)) return null;
  if (!scope.userId) return []; // sesión sin id -> nada visible (fail-closed)
  return [scope.userId, ...(await getDescendientes(scope.userId))];
}

/**
 * Acota la lista de vendedores del filtro y decide si mostrarlo, según la
 * visibilidad por subárbol:
 *  - rol global: lista completa + filtro visible.
 *  - rol acotado: solo su equipo (ámbito); el filtro se oculta si no tiene a
 *    nadie más que a sí mismo (un vendedor solitario no necesita filtro), pero
 *    un gerente/líder con equipo sí lo conserva (acotado a su gente).
 */
export async function acotarFiltroVendedor<T extends { id: string }>(
  scope: DashboardScope,
  vendedores: ReadonlyArray<T>,
): Promise<{ vendedores: T[]; ocultarFiltro: boolean }> {
  const ambito = await idsEnAmbito(scope);
  if (!ambito) return { vendedores: [...vendedores], ocultarFiltro: false };
  const set = new Set(ambito);
  return {
    vendedores: vendedores.filter((v) => set.has(v.id)),
    ocultarFiltro: ambito.length <= 1,
  };
}

/** Fragmento SQL "(id1, id2, …)" parametrizado para usar con IN; vacío -> "(NULL)". */
function sqlIdList(ids: string[]): SQL {
  if (ids.length === 0) return sql`(NULL)`;
  // Cast explícito a uuid para que el IN compare contra columnas uuid sin
  // depender de la inferencia de tipos del driver.
  return sql`(${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** Orden canonico de etapas del pipeline (para ordenar/visualizar). */
export const ETAPA_ORDER = [
  "calificacion",
  "levantamiento",
  "propuesta",
  "negociacion",
  "ganada",
  "perdida",
] as const;

/** Orden canonico de fases de proyecto. */
export const FASE_ORDER = [
  "input_comercial",
  "inicio",
  "planeacion",
  "ejecucion",
  "seguimiento",
  "cierre",
  "garantia",
] as const;

export interface KpiMetric {
  actual: number;
  previo: number;
  deltaPct: number | null;
}

export interface DashboardKpis {
  leadsNuevos: KpiMetric;
  oportAbiertas: KpiMetric;
  pipelinePonderado: KpiMetric;
  proyectosActivos: KpiMetric;
  cobranzaPendiente: KpiMetric;
}

export interface LeadsSeriePoint {
  dia: string;
  n: number;
}

export interface PipelineEtapaRow {
  etapa: string;
  conteo: number;
  monto: number;
}

export interface ProyectoFaseRow {
  fase: string;
  conteo: number;
  total: number;
}

export interface MiActividadRow {
  id: string;
  tipo: string;
  titulo: string;
  estado: string;
  prioridad: string;
  venceAt: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  vencida: boolean;
}

export interface EventoRow {
  id: string;
  entidadTipo: string;
  entidadId: string;
  tipo: string;
  descripcion: string | null;
  actor: string;
  createdAt: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  leadsSerie: LeadsSeriePoint[];
  pipeline: PipelineEtapaRow[];
  proyectosFase: ProyectoFaseRow[];
  misActividades: MiActividadRow[];
  actividadReciente: EventoRow[];
}

/* ── Helpers de narrowing para filas crudas (db.execute -> unknown) ──────── */

type Row = Record<string, unknown>;

function asRows(result: { rows: unknown[] }): Row[] {
  return result.rows as Row[];
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  return v == null ? null : str(v);
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

/** deltaPct: null si no hay base previa; si no, ((actual-previo)/previo)*100 a 1 decimal. */
function deltaPct(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return Math.round(((actual - previo) / previo) * 1000) / 10;
}

/**
 * KPIs del dashboard.
 *
 * Ventanas temporales:
 *  - actual = created_at >= now() - interval '30 days'
 *  - previa = created_at en [60d, 30d)  (mes anterior)
 *
 * Para `leadsNuevos` el valor "actual" del KPI ES el flujo de altas en la
 * ventana (leads creados ultimos 30d) y el delta compara contra la ventana
 * previa.
 *
 * Para `oportAbiertas`, `proyectosActivos` y `cobranzaPendiente` el valor
 * "actual" del KPI es el STOCK vigente (no el flujo). Como un stock no tiene
 * "ventana", usamos las ALTAS en cada ventana (creadas ult. 30d vs [60,30)d)
 * SOLO como proxy del delta/tendencia. Documentado por columna abajo.
 *
 * `pipelinePonderado` actual = sum(monto_estimado * probabilidad/100) sobre
 * oportunidades abiertas; el proxy de delta usa la misma ponderacion sobre las
 * altas de cada ventana.
 */
export async function getDashboardKpis(
  scope: DashboardScope,
): Promise<DashboardKpis> {
  // Ámbito de visibilidad por subárbol (null = rol global, sin filtro).
  const ambito = await idsEnAmbito(scope);
  const enAmbito = ambito ? sqlIdList(ambito) : null;

  // Filtros de propiedad por tabla (vacio = sin filtro para roles globales).
  const fLead = enAmbito ? sql`AND vendedor_id IN ${enAmbito}` : sql``;
  const fOport = enAmbito ? sql`AND vendedor_id IN ${enAmbito}` : sql``;
  const fProy = enAmbito ? sql`AND vendedor_id IN ${enAmbito}` : sql``;
  // pagos no tiene vendedor_id -> se acota via el proyecto dueño.
  const fPago = enAmbito
    ? sql`AND EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = p.proyecto_id AND pr.vendedor_id IN ${enAmbito})`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      -- leadsNuevos: FLUJO de altas (actual vs ventana previa).
      (SELECT count(*) FROM leads
        WHERE created_at >= now() - interval '30 days' ${fLead})::int AS leads_actual,
      (SELECT count(*) FROM leads
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fLead})::int AS leads_previo,

      -- oportAbiertas: STOCK vigente (etapa NOT IN ganada/perdida).
      (SELECT count(*) FROM oportunidades
        WHERE etapa NOT IN ('ganada','perdida') ${fOport})::int AS oport_actual,
      -- proxy delta: altas por ventana.
      (SELECT count(*) FROM oportunidades
        WHERE created_at >= now() - interval '30 days' ${fOport})::int AS oport_prev_cur,
      (SELECT count(*) FROM oportunidades
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fOport})::int AS oport_prev_old,

      -- pipelinePonderado: STOCK ponderado sobre abiertas.
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE etapa NOT IN ('ganada','perdida') ${fOport}) AS pipe_actual,
      -- proxy delta: ponderado de altas por ventana.
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE created_at >= now() - interval '30 days' ${fOport}) AS pipe_prev_cur,
      (SELECT coalesce(sum(coalesce(monto_estimado,0) * coalesce(probabilidad,0) / 100.0),0)::float8
        FROM oportunidades
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fOport}) AS pipe_prev_old,

      -- proyectosActivos: STOCK vigente (fase NOT IN cierre/garantia).
      (SELECT count(*) FROM proyectos
        WHERE fase NOT IN ('cierre','garantia') ${fProy})::int AS proy_actual,
      (SELECT count(*) FROM proyectos
        WHERE created_at >= now() - interval '30 days' ${fProy})::int AS proy_prev_cur,
      (SELECT count(*) FROM proyectos
        WHERE created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fProy})::int AS proy_prev_old,

      -- cobranzaPendiente: STOCK de monto por cobrar (estado programado/vencido).
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido') ${fPago}) AS cob_actual,
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido')
          AND created_at >= now() - interval '30 days' ${fPago}) AS cob_prev_cur,
      (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
        WHERE estado IN ('programado','vencido')
          AND created_at >= now() - interval '60 days'
          AND created_at <  now() - interval '30 days' ${fPago}) AS cob_prev_old
  `);

  const r = asRows(result)[0] ?? {};

  const leadsActual = num(r.leads_actual);
  const leadsPrevio = num(r.leads_previo);

  const oportActual = num(r.oport_actual);
  const oportPrevCur = num(r.oport_prev_cur);
  const oportPrevOld = num(r.oport_prev_old);

  const pipeActual = num(r.pipe_actual);
  const pipePrevCur = num(r.pipe_prev_cur);
  const pipePrevOld = num(r.pipe_prev_old);

  const proyActual = num(r.proy_actual);
  const proyPrevCur = num(r.proy_prev_cur);
  const proyPrevOld = num(r.proy_prev_old);

  const cobActual = num(r.cob_actual);
  const cobPrevCur = num(r.cob_prev_cur);
  const cobPrevOld = num(r.cob_prev_old);

  return {
    leadsNuevos: {
      actual: leadsActual,
      previo: leadsPrevio,
      deltaPct: deltaPct(leadsActual, leadsPrevio),
    },
    // El stock es el valor mostrado; el delta usa las altas como proxy.
    oportAbiertas: {
      actual: oportActual,
      previo: oportPrevOld,
      deltaPct: deltaPct(oportPrevCur, oportPrevOld),
    },
    pipelinePonderado: {
      actual: pipeActual,
      previo: pipePrevOld,
      deltaPct: deltaPct(pipePrevCur, pipePrevOld),
    },
    proyectosActivos: {
      actual: proyActual,
      previo: proyPrevOld,
      deltaPct: deltaPct(proyPrevCur, proyPrevOld),
    },
    cobranzaPendiente: {
      actual: cobActual,
      previo: cobPrevOld,
      deltaPct: deltaPct(cobPrevCur, cobPrevOld),
    },
  };
}

/**
 * Serie de leads por dia de los ultimos 30 dias (incluye hoy). Rellena con 0
 * los dias sin leads via generate_series LEFT JOIN. `dia` en 'YYYY-MM-DD'.
 */
export async function getLeadsSerie30d(
  scope: DashboardScope,
): Promise<LeadsSeriePoint[]> {
  const ambito = await idsEnAmbito(scope);
  const fLead = ambito
    ? sql`AND l.vendedor_id IN ${sqlIdList(ambito)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
           count(l.id)::int AS n
    FROM generate_series(current_date - 29, current_date, interval '1 day') AS d(dia)
    LEFT JOIN leads l
      ON date(l.created_at) = d.dia ${fLead}
    GROUP BY d.dia
    ORDER BY d.dia ASC
  `);

  return asRows(result).map((row) => ({
    dia: str(row.dia),
    n: num(row.n),
  }));
}

/**
 * Pipeline agrupado por etapa: conteo + monto estimado total. Devuelve las
 * filas en el orden canonico ETAPA_ORDER (etapas sin datos se omiten; las
 * presentes se reordenan).
 */
export async function getPipelinePorEtapa(
  scope: DashboardScope,
): Promise<PipelineEtapaRow[]> {
  const ambito = await idsEnAmbito(scope);
  const fOport = ambito
    ? sql`WHERE vendedor_id IN ${sqlIdList(ambito)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT etapa::text AS etapa,
           count(*)::int AS conteo,
           coalesce(sum(coalesce(monto_estimado,0)),0)::float8 AS monto
    FROM oportunidades
    ${fOport}
    GROUP BY etapa
  `);

  const rows = asRows(result).map((row) => ({
    etapa: str(row.etapa),
    conteo: num(row.conteo),
    monto: num(row.monto),
  }));

  return sortByOrder(rows, (r) => r.etapa, ETAPA_ORDER);
}

/**
 * Proyectos agrupados por fase: conteo + total con IVA. Ordenado por
 * FASE_ORDER.
 */
export async function getProyectosPorFase(
  scope: DashboardScope,
): Promise<ProyectoFaseRow[]> {
  const ambito = await idsEnAmbito(scope);
  const fProy = ambito
    ? sql`WHERE vendedor_id IN ${sqlIdList(ambito)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT fase::text AS fase,
           count(*)::int AS conteo,
           coalesce(sum(coalesce(total_con_iva,0)),0)::float8 AS total
    FROM proyectos
    ${fProy}
    GROUP BY fase
  `);

  const rows = asRows(result).map((row) => ({
    fase: str(row.fase),
    conteo: num(row.conteo),
    total: num(row.total),
  }));

  return sortByOrder(rows, (r) => r.fase, FASE_ORDER);
}

/**
 * Actividades pendientes asignadas a un usuario, ordenadas por vencimiento
 * (nulls al final). `vencida` = vence_at no nulo y ya pasado. No depende del
 * scope de rol: siempre son las del usuario indicado.
 */
export async function getMisActividadesPendientes(
  userId: string,
  limit = 8,
): Promise<MiActividadRow[]> {
  const result = await db.execute(sql`
    SELECT id::text AS id,
           tipo::text AS tipo,
           titulo,
           estado::text AS estado,
           prioridad::text AS prioridad,
           vence_at AS vence_at,
           entidad_tipo::text AS entidad_tipo,
           entidad_id::text AS entidad_id,
           (vence_at IS NOT NULL AND vence_at < now()) AS vencida
    FROM actividades
    WHERE asignado_a = ${userId}
      AND estado = 'pendiente'
    ORDER BY vence_at ASC NULLS LAST
    LIMIT ${limit}
  `);

  return asRows(result).map((row) => ({
    id: str(row.id),
    tipo: str(row.tipo),
    titulo: str(row.titulo),
    estado: str(row.estado),
    prioridad: str(row.prioridad),
    venceAt: strOrNull(row.vence_at),
    entidadTipo: strOrNull(row.entidad_tipo),
    entidadId: strOrNull(row.entidad_id),
    vencida: bool(row.vencida),
  }));
}

/**
 * Feed de eventos recientes (timeline global).
 *
 * Scoping: para roles acotados (vendedor/preventa) el feed se filtra a eventos
 * de entidades que son del usuario. Como `eventos` no tiene vendedor_id, se
 * resuelve por (entidad_tipo, entidad_id) con un EXISTS contra la tabla dueña
 * de cada tipo. Solo se acotan los tipos con dueño comercial conocido
 * (lead/oportunidad/proyecto vía vendedor_id, y cliente vía sus oportunidades);
 * eventos de otros tipos quedan fuera del feed de un rol acotado. Para roles
 * globales se devuelve el feed completo sin filtro.
 */
export async function getActividadReciente(
  scope: DashboardScope,
  limit = 10,
): Promise<EventoRow[]> {
  // Filtro de propiedad por subárbol para roles acotados. Un evento es visible
  // si su entidad pertenece a alguien del ámbito (self + descendientes). Cubre
  // lead/oportunidad/proyecto directamente y cliente vía sus oportunidades.
  const ambito = await idsEnAmbito(scope);
  const lista = ambito ? sqlIdList(ambito) : null;
  const ownership = lista
    ? sql`WHERE (
        (e.entidad_tipo = 'lead'        AND EXISTS (SELECT 1 FROM leads x         WHERE x.id = e.entidad_id AND x.vendedor_id IN ${lista}))
     OR (e.entidad_tipo = 'oportunidad' AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.id = e.entidad_id AND x.vendedor_id IN ${lista}))
     OR (e.entidad_tipo = 'proyecto'    AND EXISTS (SELECT 1 FROM proyectos x     WHERE x.id = e.entidad_id AND x.vendedor_id IN ${lista}))
     OR (e.entidad_tipo = 'cliente'     AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.cliente_id = e.entidad_id AND x.vendedor_id IN ${lista}))
      )`
    : sql``;

  const result = await db.execute(sql`
    SELECT e.id::text AS id,
           e.entidad_tipo::text AS entidad_tipo,
           e.entidad_id::text AS entidad_id,
           e.tipo,
           e.descripcion,
           e.actor,
           e.created_at AS created_at
    FROM eventos e
    ${ownership}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `);

  return asRows(result).map((row) => ({
    id: str(row.id),
    entidadTipo: str(row.entidad_tipo),
    entidadId: str(row.entidad_id),
    tipo: str(row.tipo),
    descripcion: strOrNull(row.descripcion),
    actor: str(row.actor),
    createdAt: str(row.created_at),
  }));
}

/** Agrega todas las lecturas del dashboard en paralelo. */
export async function getDashboardData(
  scope: DashboardScope,
): Promise<DashboardData> {
  const [
    kpis,
    leadsSerie,
    pipeline,
    proyectosFase,
    misActividades,
    actividadReciente,
  ] = await Promise.all([
    getDashboardKpis(scope),
    getLeadsSerie30d(scope),
    getPipelinePorEtapa(scope),
    getProyectosPorFase(scope),
    getMisActividadesPendientes(scope.userId),
    getActividadReciente(scope),
  ]);

  return {
    kpis,
    leadsSerie,
    pipeline,
    proyectosFase,
    misActividades,
    actividadReciente,
  };
}

/**
 * Ordena filas segun el indice de su clave en `order`. Las claves presentes en
 * `order` van primero (en ese orden); claves desconocidas quedan al final
 * preservando su orden relativo.
 */
function sortByOrder<T>(
  rows: T[],
  key: (row: T) => string,
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((value, index) => [value, index]));
  return [...rows].sort((a, b) => {
    const ra = rank.get(key(a)) ?? order.length;
    const rb = rank.get(key(b)) ?? order.length;
    return ra - rb;
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * LEADS / PIPELINE (D3) — capa de datos
 *
 * Estilo: query builder de Drizzle (eq/ilike/and/or/gte/lte/lt/isNull/count) +
 * leftJoin. Los numeric (mode:'string') se convierten con Number(...). Scoping
 * por rol vía isScoped(): vendedor/preventa ven SOLO sus entidades.
 * ──────────────────────────────────────────────────────────────────────── */

export type LeadEstado = (typeof schema.leadEstado.enumValues)[number];
export type LeadCanal = (typeof schema.leadCanal.enumValues)[number];

export interface LeadsFiltros {
  estado?: LeadEstado;
  canal?: LeadCanal;
  vendedorId?: string | null;
  scoreMin?: number;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export interface LeadRow {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  segmento: string | null;
  canal: string | null;
  score: number;
  estado: string;
  vendedorId: string | null;
  vendedorNombre: string | null;
  municipio: string | null;
  estadoMx: string | null;
  consumoKwhMes: number | null;
  reciboMxn: number | null;
  sizingKwp: number | null;
  createdAt: string;
}

export interface LeadsResumen {
  porEstado: Array<{ estado: string; n: number }>;
  total: number;
}

export interface VendedorOption {
  id: string;
  nombre: string;
  rol: string;
}

export interface OportunidadRow {
  id: string;
  nombre: string;
  etapa: string;
  clienteId: string | null;
  clienteNombre: string | null;
  leadId: string | null;
  leadNombre: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  capacidadKwp: number | null;
  montoEstimado: number;
  probabilidad: number;
  montoPonderado: number;
  fechaCierreEstimada: string | null;
  motivoPerdida: string | null;
  createdAt: string;
}

export interface PipelineForecastEtapa {
  etapa: string;
  conteo: number;
  monto: number;
  ponderado: number;
}

export interface PipelineData {
  oportunidades: OportunidadRow[];
  forecast: PipelineForecastEtapa[];
  forecastTotal: number;
  montoTotalAbierto: number;
}

/** numeric(mode:'string') -> number | null. */
function numOrNull(v: string | null): number | null {
  if (v == null) return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

/** numeric(mode:'string') con default 0 -> number. */
function numOrZero(v: string | null): number {
  return numOrNull(v) ?? 0;
}

const LEAD_QUERY_LIMIT = 500;
const OPORTUNIDAD_QUERY_LIMIT = 500;

/**
 * Lista de leads filtrada. Scoping por vendedor para roles acotados. Filtros:
 * estado, canal, vendedorId (null = sin asignar / isNull), scoreMin (gte),
 * busqueda (ilike nombre/email/telefono), desde (gte) y hasta (lt) sobre
 * created_at. Incluye nombre del vendedor vía leftJoin a usuarios.
 */
/** Construye las condiciones WHERE de un listado de leads (scope + filtros). */
async function leadsWhereConds(
  scope: DashboardScope,
  filtros: LeadsFiltros,
): Promise<SQL[]> {
  const conds: SQL[] = [];

  const ambito = await idsEnAmbito(scope);
  if (ambito) {
    conds.push(inArray(schema.leads.vendedorId, ambito));
  }

  if (filtros.estado) conds.push(eq(schema.leads.estado, filtros.estado));
  if (filtros.canal) conds.push(eq(schema.leads.canal, filtros.canal));

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.leads.vendedorId)
        : eq(schema.leads.vendedorId, filtros.vendedorId),
    );
  }

  if (typeof filtros.scoreMin === "number") {
    conds.push(gte(schema.leads.score, filtros.scoreMin));
  }

  if (filtros.desde) conds.push(gte(schema.leads.createdAt, filtros.desde));
  if (filtros.hasta) conds.push(lt(schema.leads.createdAt, filtros.hasta));

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.leads.nombre, like),
      ilike(schema.leads.email, like),
      ilike(schema.leads.telefono, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  return conds;
}

/** Proyección estándar de fila de lead para listados (tabla/kanban). */
const leadListSelect = {
  id: schema.leads.id,
  nombre: schema.leads.nombre,
  email: schema.leads.email,
  telefono: schema.leads.telefono,
  segmento: schema.leads.segmento,
  canal: schema.leads.canal,
  score: schema.leads.score,
  estado: schema.leads.estado,
  vendedorId: schema.leads.vendedorId,
  vendedorNombre: schema.usuarios.nombre,
  municipio: schema.leads.municipio,
  estadoMx: schema.leads.estadoMx,
  consumoKwhMes: schema.leads.consumoKwhMes,
  reciboMxn: schema.leads.reciboMxn,
  sizingKwp: schema.leads.sizingKwp,
  createdAt: schema.leads.createdAt,
};

/** Normaliza una fila cruda (numeric -> number) a LeadRow. */
function mapLeadRow(row: {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  segmento: string | null;
  canal: string | null;
  score: number;
  estado: string;
  vendedorId: string | null;
  vendedorNombre: string | null;
  municipio: string | null;
  estadoMx: string | null;
  consumoKwhMes: string | null;
  reciboMxn: string | null;
  sizingKwp: string | null;
  createdAt: string;
}): LeadRow {
  return {
    ...row,
    consumoKwhMes: numOrNull(row.consumoKwhMes),
    reciboMxn: numOrNull(row.reciboMxn),
    sizingKwp: numOrNull(row.sizingKwp),
  };
}

export async function getLeadsFiltrados(
  scope: DashboardScope,
  filtros: LeadsFiltros = {},
): Promise<LeadRow[]> {
  const conds = await leadsWhereConds(scope, filtros);

  const rows = await db
    .select(leadListSelect)
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.vendedorId, schema.usuarios.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.leads.createdAt))
    .limit(LEAD_QUERY_LIMIT);

  return rows.map(mapLeadRow);
}

export interface LeadsPage {
  rows: LeadRow[];
  /** Total de filas que cumplen el filtro (para la paginación). */
  total: number;
}

/** Filtros serializables que el cliente envía al server action fetchLeads. */
export interface FetchLeadsFiltros {
  estado?: string | null;
  canal?: string | null;
  /** null = sin asignar; undefined = sin filtro de responsable. */
  vendedorId?: string | null;
  scoreMin?: number | null;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export interface FetchLeadsInput {
  filtros?: FetchLeadsFiltros;
  limit: number;
  offset: number;
}

/**
 * Página de leads del lado del servidor: cuenta el total que cumple el filtro y
 * devuelve solo la ventana [offset, offset+limit). Usada por la tabla
 * (paginación) y por el kanban (scroll infinito por columna, vía `estado`).
 */
export async function getLeadsPage(
  scope: DashboardScope,
  filtros: LeadsFiltros,
  opts: { limit: number; offset: number },
): Promise<LeadsPage> {
  const conds = await leadsWhereConds(scope, filtros);
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.leads)
    .where(where);

  const rows = await db
    .select(leadListSelect)
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.vendedorId, schema.usuarios.id))
    .where(where)
    .orderBy(desc(schema.leads.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);

  return { rows: rows.map(mapLeadRow), total: Number(total) };
}

/**
 * Resumen de leads por estado (conteo). Mismo scoping que getLeadsFiltrados.
 * Rellena con 0 las 8 claves del enum leadEstado y respeta su orden canónico.
 */
export async function getLeadsResumen(
  scope: DashboardScope,
): Promise<LeadsResumen> {
  const ambito = await idsEnAmbito(scope);
  const scopeCond = ambito
    ? inArray(schema.leads.vendedorId, ambito)
    : undefined;

  const rows = await db
    .select({ estado: schema.leads.estado, n: count() })
    .from(schema.leads)
    .where(scopeCond)
    .groupBy(schema.leads.estado);

  const conteos = new Map<string, number>(
    rows.map((row) => [row.estado, Number(row.n)]),
  );

  const porEstado = schema.leadEstado.enumValues.map((estado) => ({
    estado,
    n: conteos.get(estado) ?? 0,
  }));

  const total = porEstado.reduce((acc, item) => acc + item.n, 0);

  return { porEstado, total };
}

/**
 * Opciones de vendedores activos con rol comercial (admin/gerente/vendedor/
 * preventa), ordenadas por nombre. Para selects de asignación.
 */
export async function getVendedores(): Promise<VendedorOption[]> {
  const rows = await db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.usuarios)
    .where(
      and(
        eq(schema.usuarios.activo, true),
        or(
          eq(schema.usuarios.rol, "admin"),
          eq(schema.usuarios.rol, "gerente"),
          eq(schema.usuarios.rol, "vendedor"),
          eq(schema.usuarios.rol, "preventa"),
        ),
      ),
    )
    .orderBy(asc(schema.usuarios.nombre));

  return rows.map((row) => ({ id: row.id, nombre: row.nombre, rol: row.rol }));
}

/**
 * Usuarios a los que el usuario actual PUEDE asignar una actividad, según la
 * regla POR JERARQUÍA (Fase 2):
 *  - admin: cualquiera (es global).
 *  - resto de roles: a sí mismo + a sus descendientes en la línea de reporte
 *    (subárbol), solo usuarios activos. Un gerente solo ve a su equipo; un
 *    vendedor sin reportes, solo a sí mismo.
 * "Sin asignar" se ofrece siempre en la UI; aquí se devuelven los destinos
 * nominales válidos. Es la fuente de verdad de la UI; la action revalida.
 */
export async function getUsuariosAsignables(
  scope: DashboardScope,
): Promise<VendedorOption[]> {
  if (scope.rol === "admin") return getVendedores();
  if (!scope.userId) return []; // sesión sin id -> sin asignables

  // self + subárbol (descendientes en reporta_a), únicamente activos.
  // scope.userId siempre presente aquí (sesión válida); va primero en la lista.
  const ids = [scope.userId, ...(await getDescendientes(scope.userId))];

  const rows = await db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.usuarios)
    .where(and(inArray(schema.usuarios.id, ids), eq(schema.usuarios.activo, true)))
    .orderBy(asc(schema.usuarios.nombre));

  return rows.map((row) => ({ id: row.id, nombre: row.nombre, rol: row.rol }));
}

// ===================== ORGANIZACIÓN (áreas + organigrama) =====================

export interface AreaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  liderId: string | null;
  liderNombre: string | null;
  activa: boolean;
  miembros: number;
  createdAt: string;
  updatedAt: string;
}

export interface AreasFiltros {
  busqueda?: string;
  soloActivas?: boolean;
}

export interface AreasPage {
  rows: AreaRow[];
  total: number;
}

/** Página de áreas con líder y conteo de miembros. */
export async function getAreasPage(
  filtros: AreasFiltros,
  opts: { limit: number; offset: number },
): Promise<AreasPage> {
  const conds: SQL[] = [];
  if (filtros.soloActivas) conds.push(eq(schema.areas.activa, true));
  const q = filtros.busqueda?.trim();
  if (q) conds.push(ilike(schema.areas.nombre, `%${q}%`));
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.areas)
    .where(where);

  const lider = alias(schema.usuarios, "lider");
  // Conteo de miembros por área (subconsulta correlacionada). `areas.id` se
  // referencia con sql.raw para que no se renderice sin calificar (ambigüedad).
  const miembros = sql<number>`(
    SELECT count(*)::int FROM usuarios m WHERE m.area_id = ${sql.raw("areas.id")}
  )`;

  const rows = await db
    .select({
      id: schema.areas.id,
      nombre: schema.areas.nombre,
      descripcion: schema.areas.descripcion,
      liderId: schema.areas.liderId,
      liderNombre: lider.nombre,
      activa: schema.areas.activa,
      miembros,
      createdAt: schema.areas.createdAt,
      updatedAt: schema.areas.updatedAt,
    })
    .from(schema.areas)
    .leftJoin(lider, eq(schema.areas.liderId, lider.id))
    .where(where)
    .orderBy(asc(schema.areas.nombre))
    .limit(opts.limit)
    .offset(opts.offset);

  return {
    rows: rows.map((r) => ({ ...r, miembros: Number(r.miembros) })),
    total: Number(total),
  };
}

/** Áreas activas para selects (id + nombre). */
export async function getAreasActivas(): Promise<{ id: string; nombre: string }[]> {
  return db
    .select({ id: schema.areas.id, nombre: schema.areas.nombre })
    .from(schema.areas)
    .where(eq(schema.areas.activa, true))
    .orderBy(asc(schema.areas.nombre));
}

/** KPIs comerciales agregados por área (Fase 4). */
export interface AreaKpiRow {
  id: string;
  nombre: string;
  miembros: number;
  leads: number;
  oportunidadesAbiertas: number;
  montoPonderado: number;
  clientes: number;
  proyectos: number;
}

/**
 * KPIs por área (departamento): agrega leads/oportunidades/clientes/proyectos
 * por el área del vendedor dueño de cada registro. Respeta la visibilidad por
 * subárbol (idsEnAmbito): admin ve todas las áreas con todo; un rol acotado solo
 * ve las áreas donde trabaja su subárbol, y los conteos (incl. `miembros`) están
 * acotados a su subárbol (no reflejan el total real del área para roles
 * acotados). Áreas activas.
 */
export async function getKpisPorArea(scope: DashboardScope): Promise<AreaKpiRow[]> {
  const ambito = await idsEnAmbito(scope);
  const lista = ambito ? sqlIdList(ambito) : null;
  const fUser = lista ? sql`AND u.id IN ${lista}` : sql``;
  const fLead = lista ? sql`AND l.vendedor_id IN ${lista}` : sql``;
  const fOport = lista ? sql`AND o.vendedor_id IN ${lista}` : sql``;
  const fCli = lista ? sql`AND c.vendedor_id IN ${lista}` : sql``;
  const fProy = lista ? sql`AND p.vendedor_id IN ${lista}` : sql``;
  // Un rol acotado solo debe ver las áreas donde hay alguien de su subárbol
  // (no el catálogo completo de áreas de la empresa con ceros).
  const fArea = lista
    ? sql`AND ar.id IN (SELECT DISTINCT area_id FROM usuarios WHERE area_id IS NOT NULL AND id IN ${lista})`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      ar.id::text AS id,
      ar.nombre AS nombre,
      (SELECT count(*)::int FROM usuarios u
         WHERE u.area_id = ar.id AND u.activo ${fUser}) AS miembros,
      (SELECT count(*)::int FROM leads l JOIN usuarios u ON u.id = l.vendedor_id
         WHERE u.area_id = ar.id ${fLead}) AS leads,
      (SELECT count(*)::int FROM oportunidades o JOIN usuarios u ON u.id = o.vendedor_id
         WHERE u.area_id = ar.id AND o.etapa NOT IN ('ganada','perdida') ${fOport}) AS oport_abiertas,
      (SELECT coalesce(sum(o.monto_estimado * o.probabilidad / 100.0), 0)::float8
         FROM oportunidades o JOIN usuarios u ON u.id = o.vendedor_id
         WHERE u.area_id = ar.id AND o.etapa NOT IN ('ganada','perdida') ${fOport}) AS monto_ponderado,
      (SELECT count(*)::int FROM clientes c JOIN usuarios u ON u.id = c.vendedor_id
         WHERE u.area_id = ar.id ${fCli}) AS clientes,
      (SELECT count(*)::int FROM proyectos p JOIN usuarios u ON u.id = p.vendedor_id
         WHERE u.area_id = ar.id ${fProy}) AS proyectos
    FROM areas ar
    WHERE ar.activa ${fArea}
    ORDER BY ar.nombre
  `);

  return asRows(result).map((r) => ({
    id: str(r.id),
    nombre: str(r.nombre),
    miembros: num(r.miembros),
    leads: num(r.leads),
    oportunidadesAbiertas: num(r.oport_abiertas),
    montoPonderado: num(r.monto_ponderado),
    clientes: num(r.clientes),
    proyectos: num(r.proyectos),
  }));
}

// ===================== CAMPAÑAS (marketing) =====================

export interface CampanaRow {
  id: string;
  nombre: string;
  plataforma: string;
  estado: string;
  segmento: string | null;
  zona: string | null;
  objetivo: string | null;
  presupuesto: number | null;
  gasto: number | null;
  moneda: string;
  utmCampaign: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  leads: number;
  cpl: number | null;
  createdAt: string;
}

export interface CampanasFiltros {
  estado?: string;
  plataforma?: string;
  busqueda?: string;
}

export interface CampanasPage {
  rows: CampanaRow[];
  total: number;
}

/**
 * Página de campañas de marketing con atribución de leads (count de
 * leads.campana_id) y CPL = gasto/leads. El gasto sale de `metricas->>'gasto'`
 * (si se registró) o, en su defecto, del presupuesto. No se acota por vendedor:
 * marketing es global.
 */
export async function getCampanasPage(
  filtros: CampanasFiltros,
  opts: { limit: number; offset: number },
): Promise<CampanasPage> {
  const conds: SQL[] = [];
  if (filtros.estado) conds.push(sql`c.estado::text = ${filtros.estado}`);
  if (filtros.plataforma) conds.push(sql`c.plataforma::text = ${filtros.plataforma}`);
  const q = filtros.busqueda?.trim();
  if (q) conds.push(sql`c.nombre ILIKE ${"%" + q + "%"}`);
  const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

  const [{ total }] = asRows(
    await db.execute(sql`SELECT count(*)::int AS total FROM campanas c ${where}`),
  ).map((r) => ({ total: num(r.total) }));

  const result = await db.execute(sql`
    SELECT c.id::text AS id,
           c.nombre,
           c.plataforma::text AS plataforma,
           c.estado::text AS estado,
           c.segmento,
           c.zona,
           c.objetivo,
           c.presupuesto::float8 AS presupuesto,
           (c.metricas->>'gasto')::float8 AS gasto,
           c.moneda,
           c.utm_campaign AS utm_campaign,
           c.fecha_inicio::text AS fecha_inicio,
           c.fecha_fin::text AS fecha_fin,
           (SELECT count(*)::int FROM leads l WHERE l.campana_id = c.id) AS leads,
           c.created_at AS created_at
    FROM campanas c
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ${opts.limit} OFFSET ${opts.offset}
  `);

  const rows: CampanaRow[] = asRows(result).map((r) => {
    const presupuesto = r.presupuesto == null ? null : num(r.presupuesto);
    const gasto = r.gasto == null ? presupuesto : num(r.gasto);
    const leads = num(r.leads);
    const cpl = gasto != null && leads > 0 ? Math.round((gasto / leads) * 100) / 100 : null;
    return {
      id: str(r.id),
      nombre: str(r.nombre),
      plataforma: str(r.plataforma),
      estado: str(r.estado),
      segmento: strOrNull(r.segmento),
      zona: strOrNull(r.zona),
      objetivo: strOrNull(r.objetivo),
      presupuesto,
      gasto: gasto,
      moneda: str(r.moneda) || "MXN",
      utmCampaign: strOrNull(r.utm_campaign),
      fechaInicio: strOrNull(r.fecha_inicio),
      fechaFin: strOrNull(r.fecha_fin),
      leads,
      cpl,
      createdAt: str(r.created_at),
    };
  });

  return { rows, total };
}

/** Nodo del organigrama (usuario con su jefe y área). */
export interface OrganigramaNodo {
  id: string;
  nombre: string;
  cargo: string | null;
  rol: string;
  reportaA: string | null;
  areaId: string | null;
  areaNombre: string | null;
  activo: boolean;
}

/**
 * Nodos del organigrama: usuarios activos con su línea de reporte y área. El
 * árbol se arma en el cliente (raíces = reportaA null o fuera del conjunto).
 */
export async function getOrganigrama(): Promise<OrganigramaNodo[]> {
  const rows = await db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      cargo: schema.usuarios.cargo,
      rol: schema.usuarios.rol,
      reportaA: schema.usuarios.reportaA,
      areaId: schema.usuarios.areaId,
      areaNombre: schema.areas.nombre,
      activo: schema.usuarios.activo,
    })
    .from(schema.usuarios)
    .leftJoin(schema.areas, eq(schema.usuarios.areaId, schema.areas.id))
    .where(eq(schema.usuarios.activo, true))
    .orderBy(asc(schema.usuarios.nombre));

  return rows;
}

/**
 * Ids de todos los descendientes de un usuario en la línea de reporte (subárbol,
 * sin incluirlo a él). Se usa para prevenir ciclos al asignar jefe y para la
 * visibilidad por equipo (Fase 3). CTE recursivo.
 *
 * Memoizado con React cache(): durante una misma request/render, varias queries
 * que resuelven el ámbito del mismo usuario comparten un solo CTE (p. ej. el
 * dashboard ejecuta varias lecturas). La clave de memo es el userId.
 */
export const getDescendientes = cache(
  async (userId: string): Promise<string[]> => {
    if (!userId) return [];
    // Lleva el camino recorrido para cortar ciclos si la data quedara corrupta
    // (defensa en profundidad; los ciclos ya se previenen al asignar jefe).
    const result = await db.execute(sql`
      WITH RECURSIVE sub AS (
        SELECT id, ARRAY[${userId}::uuid, id] AS path
        FROM usuarios WHERE reporta_a = ${userId}
        UNION ALL
        SELECT u.id, sub.path || u.id
        FROM usuarios u JOIN sub ON u.reporta_a = sub.id
        WHERE NOT (u.id = ANY(sub.path))
      )
      SELECT DISTINCT id::text AS id FROM sub
    `);
    return asRows(result).map((r) => str(r.id));
  },
);

/** Fila de asesor para la gestión en el panel (con el usuario vinculado). */
export interface AsesorRow {
  id: string;
  usuarioId: string | null;
  nombre: string;
  chatwootAgentId: number;
  msEmail: string | null;
  telefono: string | null;
  zonas: string[];
  segmentos: string[];
  activo: boolean;
  asignaciones: number;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
}

/**
 * Usuarios asignables a un lead = asesores ACTIVOS vinculados a un usuario
 * ACTIVO. El `id` devuelto es el usuario_id (lo que se guarda en
 * leads.vendedor_id). Esta es la única fuente de "asignables" para leads.
 */
export async function getAsesoresAsignables(): Promise<VendedorOption[]> {
  const rows = await db
    .select({
      id: schema.asesores.usuarioId,
      nombre: schema.usuarios.nombre,
      rol: schema.usuarios.rol,
    })
    .from(schema.asesores)
    .innerJoin(
      schema.usuarios,
      eq(schema.asesores.usuarioId, schema.usuarios.id),
    )
    .where(
      and(
        eq(schema.asesores.activo, true),
        eq(schema.usuarios.activo, true),
      ),
    )
    .orderBy(asc(schema.usuarios.nombre));

  return rows
    .filter((r) => r.id !== null)
    .map((r) => ({ id: r.id as string, nombre: r.nombre, rol: r.rol }));
}

/** Lista completa de asesores para administración (con el usuario vinculado). */
export async function getAsesores(): Promise<AsesorRow[]> {
  return db
    .select({
      id: schema.asesores.id,
      usuarioId: schema.asesores.usuarioId,
      nombre: schema.asesores.nombre,
      chatwootAgentId: schema.asesores.chatwootAgentId,
      msEmail: schema.asesores.msEmail,
      telefono: schema.asesores.telefono,
      zonas: schema.asesores.zonas,
      segmentos: schema.asesores.segmentos,
      activo: schema.asesores.activo,
      asignaciones: schema.asesores.asignaciones,
      usuarioNombre: schema.usuarios.nombre,
      usuarioEmail: schema.usuarios.email,
    })
    .from(schema.asesores)
    .leftJoin(schema.usuarios, eq(schema.asesores.usuarioId, schema.usuarios.id))
    .orderBy(asc(schema.asesores.nombre));
}

/**
 * Pipeline completo: oportunidades (con nombres de cliente/lead/vendedor vía
 * leftJoin) + forecast por etapa. Scoping por vendedor para roles acotados.
 * `montoPonderado = montoEstimado * probabilidad / 100` (en JS). El forecast
 * total y el monto total abierto suman SOLO etapas distintas de ganada/perdida.
 */
export async function getOportunidadesPipeline(
  scope: DashboardScope,
): Promise<PipelineData> {
  const leadAlias = schema.leads;

  const ambito = await idsEnAmbito(scope);
  const scopeCond = ambito
    ? inArray(schema.oportunidades.vendedorId, ambito)
    : undefined;

  const rows = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
      clienteId: schema.oportunidades.clienteId,
      clienteNombre: schema.clientes.nombre,
      leadId: schema.oportunidades.leadId,
      leadNombre: leadAlias.nombre,
      vendedorId: schema.oportunidades.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      capacidadKwp: schema.oportunidades.capacidadKwp,
      montoEstimado: schema.oportunidades.montoEstimado,
      probabilidad: schema.oportunidades.probabilidad,
      fechaCierreEstimada: schema.oportunidades.fechaCierreEstimada,
      motivoPerdida: schema.oportunidades.motivoPerdida,
      createdAt: schema.oportunidades.createdAt,
    })
    .from(schema.oportunidades)
    .leftJoin(
      schema.clientes,
      eq(schema.oportunidades.clienteId, schema.clientes.id),
    )
    .leftJoin(leadAlias, eq(schema.oportunidades.leadId, leadAlias.id))
    .leftJoin(
      schema.usuarios,
      eq(schema.oportunidades.vendedorId, schema.usuarios.id),
    )
    .where(scopeCond)
    .orderBy(desc(schema.oportunidades.createdAt))
    .limit(OPORTUNIDAD_QUERY_LIMIT);

  const oportunidades: OportunidadRow[] = rows.map((row) => {
    const montoEstimado = numOrZero(row.montoEstimado);
    const probabilidad = row.probabilidad ?? 30;
    const montoPonderado = (montoEstimado * probabilidad) / 100;
    return {
      id: row.id,
      nombre: row.nombre,
      etapa: row.etapa,
      clienteId: row.clienteId,
      clienteNombre: row.clienteNombre,
      leadId: row.leadId,
      leadNombre: row.leadNombre,
      vendedorId: row.vendedorId,
      vendedorNombre: row.vendedorNombre,
      capacidadKwp: numOrNull(row.capacidadKwp),
      montoEstimado,
      probabilidad,
      montoPonderado,
      fechaCierreEstimada: row.fechaCierreEstimada,
      motivoPerdida: row.motivoPerdida,
      createdAt: row.createdAt,
    };
  });

  const porEtapa = new Map<string, PipelineForecastEtapa>();
  for (const op of oportunidades) {
    const acc = porEtapa.get(op.etapa) ?? {
      etapa: op.etapa,
      conteo: 0,
      monto: 0,
      ponderado: 0,
    };
    porEtapa.set(op.etapa, {
      etapa: op.etapa,
      conteo: acc.conteo + 1,
      monto: acc.monto + op.montoEstimado,
      ponderado: acc.ponderado + op.montoPonderado,
    });
  }

  const forecast = sortByOrder(
    [...porEtapa.values()],
    (r) => r.etapa,
    ETAPA_ORDER,
  );

  const cerradas = new Set<string>(["ganada", "perdida"]);
  const abiertas = forecast.filter((f) => !cerradas.has(f.etapa));
  const forecastTotal = abiertas.reduce((acc, f) => acc + f.ponderado, 0);
  const montoTotalAbierto = abiertas.reduce((acc, f) => acc + f.monto, 0);

  return { oportunidades, forecast, forecastTotal, montoTotalAbierto };
}

/* ─────────────────────────────────────────────────────────────────────────
 * CLIENTES / COTIZACIONES (D4) — capa de datos
 *
 * Estilo: query builder de Drizzle (eq/ilike/and/or/isNull) + leftJoin. Los
 * numeric (mode:'string') se convierten con numOrNull/numOrZero. Los id bigint
 * (cotizacion_items) se serializan a string. Scoping por rol vía isScoped():
 * vendedor/preventa ven SOLO sus clientes/cotizaciones (vendedor_id = userId).
 * ──────────────────────────────────────────────────────────────────────── */

export type TipoPersona = (typeof schema.tipoPersona.enumValues)[number];
export type CotizacionEstado =
  (typeof schema.cotizacionEstado.enumValues)[number];
export type EsquemaCfe = (typeof schema.esquemaCfe.enumValues)[number];
export type NivelTension = (typeof schema.nivelTension.enumValues)[number];
export type EquipoTipo = (typeof schema.equipoTipo.enumValues)[number];

export interface ClientesFiltros {
  tipoPersona?: TipoPersona;
  vendedorId?: string | null;
  busqueda?: string;
}

export interface ClienteRow {
  id: string;
  tipoPersona: TipoPersona;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  municipio: string | null;
  estadoMx: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  createdAt: string;
}

export interface ContactoRow {
  id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  esPrincipal: boolean;
}

export interface ClienteOportunidadRow {
  id: string;
  nombre: string;
  etapa: string;
  montoEstimado: number;
  probabilidad: number;
  createdAt: string;
}

export interface ClienteCotizacionRow {
  id: string;
  folio: string | null;
  version: number;
  estado: CotizacionEstado;
  total: number;
  validaHasta: string | null;
  createdAt: string;
}

export interface ClienteProyectoRow {
  id: string;
  folio: string | null;
  fase: string;
  totalConIva: number | null;
}

export interface ClienteDocumentoRow {
  id: string;
  tipo: string;
  nombre: string;
  url: string;
  createdAt: string;
}

export interface ClienteActividadRow {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  venceAt: string | null;
  completadoAt: string | null;
  asignadoA: string | null;
  asignadoNombre: string | null;
  createdAt: string;
  vencida: boolean;
}

export interface ClienteDetalle {
  cliente: typeof schema.clientes.$inferSelect;
  vendedorNombre: string | null;
  municipioNombre: string | null;
  contactos: ContactoRow[];
  oportunidades: ClienteOportunidadRow[];
  cotizaciones: ClienteCotizacionRow[];
  proyectos: ClienteProyectoRow[];
  documentos: ClienteDocumentoRow[];
  actividades: ClienteActividadRow[];
  timeline: EventoRow[];
}

export interface CotizacionesFiltros {
  estado?: CotizacionEstado;
  clienteId?: string;
  vendedorId?: string | null;
  busqueda?: string;
}

export interface CotizacionRow {
  id: string;
  folio: string | null;
  version: number;
  clienteId: string | null;
  clienteNombre: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  total: number;
  estado: CotizacionEstado;
  validaHasta: string | null;
  createdAt: string;
}

export interface CotizacionItemRow {
  id: string;
  equipoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  equipoMarca: string | null;
  equipoModelo: string | null;
}

export interface CotizacionDetalleCabecera {
  id: string;
  oportunidadId: string | null;
  clienteId: string | null;
  vendedorId: string | null;
  folio: string | null;
  version: number;
  capacidadKwp: number | null;
  paneles: number | null;
  inversor: string | null;
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  produccionAnualKwh: number | null;
  ahorroAnualMxn: number | null;
  paybackAnios: number | null;
  esquema: EsquemaCfe | null;
  estado: CotizacionEstado;
  validaHasta: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface CotizacionDetalle {
  cotizacion: CotizacionDetalleCabecera;
  items: CotizacionItemRow[];
  cliente: { id: string; nombre: string; tipoPersona: TipoPersona } | null;
  oportunidad: { id: string; nombre: string; etapa: string } | null;
  documentos: ClienteDocumentoRow[];
  timeline: EventoRow[];
  /** Contexto técnico para alimentar el wizard de dimensionamiento. */
  calcContext: CotizacionCalcContext | null;
}

/**
 * Insumos técnicos que el wizard de cotización usa para dimensionar el sistema.
 * Se reúnen del cliente (ubicación/tarifa/tipoPersona) y, si existe, del lead
 * origen (segmento/consumo/recibo). Los numeric llegan como number|null.
 */
export interface CotizacionCalcContext {
  segmento: string;
  consumoKwhMes: number | null;
  reciboMxn: number | null;
  tarifa: string | null;
  municipio: string | null;
  estado: string | null;
  cp: string | null;
}

export interface CotizacionesKpis {
  total: number;
  montoAceptado: number;
  montoEnviadas: number;
  porEstado: Record<CotizacionEstado, number>;
}

export interface CatalogoOption {
  id: string;
  /** Clave del tipo de producto (producto_tipos.clave), ahora dinámica. */
  tipo: string;
  marca: string | null;
  modelo: string | null;
  potenciaWp: number | null;
  precio: number | null;
}

const CLIENTE_QUERY_LIMIT = 500;
const COTIZACION_QUERY_LIMIT = 500;

/**
 * Lista de clientes filtrada. Scoping por vendedor para roles acotados.
 * Filtros: tipoPersona (eq), vendedorId (null = sin asignar / isNull),
 * busqueda (ilike nombre/rfc/email). Incluye nombre del vendedor vía leftJoin.
 */
export async function getClientesFiltrados(
  scope: DashboardScope,
  filtros: ClientesFiltros = {},
): Promise<ClienteRow[]> {
  const conds: SQL[] = [];

  const ambito = await idsEnAmbito(scope);
  if (ambito) {
    conds.push(inArray(schema.clientes.vendedorId, ambito));
  }

  if (filtros.tipoPersona) {
    conds.push(eq(schema.clientes.tipoPersona, filtros.tipoPersona));
  }

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.clientes.vendedorId)
        : eq(schema.clientes.vendedorId, filtros.vendedorId),
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.clientes.nombre, like),
      ilike(schema.clientes.rfc, like),
      ilike(schema.clientes.email, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  const rows = await db
    .select({
      id: schema.clientes.id,
      tipoPersona: schema.clientes.tipoPersona,
      nombre: schema.clientes.nombre,
      rfc: schema.clientes.rfc,
      email: schema.clientes.email,
      telefono: schema.clientes.telefono,
      municipio: schema.clientes.municipio,
      estadoMx: schema.clientes.estadoMx,
      vendedorId: schema.clientes.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      createdAt: schema.clientes.createdAt,
    })
    .from(schema.clientes)
    .leftJoin(
      schema.usuarios,
      eq(schema.clientes.vendedorId, schema.usuarios.id),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.clientes.createdAt))
    .limit(CLIENTE_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    tipoPersona: row.tipoPersona,
    nombre: row.nombre,
    rfc: row.rfc,
    email: row.email,
    telefono: row.telefono,
    municipio: row.municipio,
    estadoMx: row.estadoMx,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    createdAt: row.createdAt,
  }));
}

/**
 * Detalle 360° de un cliente: cabecera + contactos, oportunidades,
 * cotizaciones, proyectos, documentos (entidad cliente) y timeline. Aplica
 * scoping: un rol acotado solo ve clientes propios; si no le pertenece (o no
 * existe) devuelve null.
 */
export async function getClienteDetalle(
  scope: DashboardScope,
  id: string,
): Promise<ClienteDetalle | null> {
  const [cliente] = await db
    .select()
    .from(schema.clientes)
    .where(eq(schema.clientes.id, id))
    .limit(1);

  if (!cliente) return null;
  const ambito = await idsEnAmbito(scope);
  if (ambito && (cliente.vendedorId == null || !ambito.includes(cliente.vendedorId)))
    return null;

  const [
    vendedorNombre,
    municipioNombre,
    contactos,
    oportunidades,
    cotizaciones,
    proyectos,
    documentos,
    actividades,
    timeline,
  ] = await Promise.all([
    getVendedorNombre(cliente.vendedorId),
    getMunicipioNombre(cliente.municipioId),
    getContactosDeCliente(id),
    getOportunidadesDeCliente(id),
    getCotizacionesDeCliente(id),
    getProyectosDeCliente(id),
    getDocumentosDeEntidad("cliente", id),
    getActividadesDeEntidad("cliente", id),
    getTimelineDeEntidad("cliente", id),
  ]);

  return {
    cliente,
    vendedorNombre,
    municipioNombre,
    contactos,
    oportunidades,
    cotizaciones,
    proyectos,
    documentos,
    actividades,
    timeline,
  };
}

/** Nombre del vendedor (o null). */
async function getVendedorNombre(
  vendedorId: string | null,
): Promise<string | null> {
  if (!vendedorId) return null;
  const [row] = await db
    .select({ nombre: schema.usuarios.nombre })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, vendedorId))
    .limit(1);
  return row?.nombre ?? null;
}

/** Nombre del municipio por su id (catálogo INEGI), o null. */
export async function getMunicipioNombre(
  municipioId: number | null,
): Promise<string | null> {
  if (municipioId == null) return null;
  const [row] = await db
    .select({ nombre: schema.municipios.nombre })
    .from(schema.municipios)
    .where(eq(schema.municipios.id, municipioId))
    .limit(1);
  return row?.nombre ?? null;
}

async function getContactosDeCliente(
  clienteId: string,
): Promise<ContactoRow[]> {
  const rows = await db
    .select({
      id: schema.contactos.id,
      nombre: schema.contactos.nombre,
      cargo: schema.contactos.cargo,
      email: schema.contactos.email,
      telefono: schema.contactos.telefono,
      esPrincipal: schema.contactos.esPrincipal,
    })
    .from(schema.contactos)
    .where(eq(schema.contactos.clienteId, clienteId))
    .orderBy(desc(schema.contactos.esPrincipal), asc(schema.contactos.nombre));

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    cargo: row.cargo,
    email: row.email,
    telefono: row.telefono,
    esPrincipal: row.esPrincipal,
  }));
}

/** Opción de oportunidad de un cliente (para el selector de enlace en cotización). */
export interface OportunidadOpcion {
  id: string;
  nombre: string;
  etapa: string;
}

/** Oportunidades del cliente como opciones (id/nombre/etapa), recientes primero. */
export async function getOportunidadesDeClienteOpciones(
  clienteId: string,
): Promise<OportunidadOpcion[]> {
  return db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
    })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.clienteId, clienteId))
    .orderBy(desc(schema.oportunidades.createdAt));
}

async function getOportunidadesDeCliente(
  clienteId: string,
): Promise<ClienteOportunidadRow[]> {
  const rows = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
      montoEstimado: schema.oportunidades.montoEstimado,
      probabilidad: schema.oportunidades.probabilidad,
      createdAt: schema.oportunidades.createdAt,
    })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.clienteId, clienteId))
    .orderBy(desc(schema.oportunidades.createdAt));

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    etapa: row.etapa,
    montoEstimado: numOrZero(row.montoEstimado),
    probabilidad: row.probabilidad ?? 30,
    createdAt: row.createdAt,
  }));
}

async function getCotizacionesDeCliente(
  clienteId: string,
): Promise<ClienteCotizacionRow[]> {
  const rows = await db
    .select({
      id: schema.cotizaciones.id,
      folio: schema.cotizaciones.folio,
      version: schema.cotizaciones.version,
      estado: schema.cotizaciones.estado,
      total: schema.cotizaciones.total,
      validaHasta: schema.cotizaciones.validaHasta,
      createdAt: schema.cotizaciones.createdAt,
    })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.clienteId, clienteId))
    .orderBy(desc(schema.cotizaciones.createdAt));

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    version: row.version,
    estado: row.estado,
    total: numOrZero(row.total),
    validaHasta: row.validaHasta,
    createdAt: row.createdAt,
  }));
}

async function getProyectosDeCliente(
  clienteId: string,
): Promise<ClienteProyectoRow[]> {
  const rows = await db
    .select({
      id: schema.proyectos.id,
      folio: schema.proyectos.folio,
      fase: schema.proyectos.fase,
      totalConIva: schema.proyectos.totalConIva,
    })
    .from(schema.proyectos)
    .where(eq(schema.proyectos.clienteId, clienteId))
    .orderBy(desc(schema.proyectos.createdAt));

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    fase: row.fase,
    totalConIva: numOrNull(row.totalConIva),
  }));
}

async function getDocumentosDeEntidad(
  entidadTipo: (typeof schema.entidadTipo.enumValues)[number],
  entidadId: string,
): Promise<ClienteDocumentoRow[]> {
  const rows = await db
    .select({
      id: schema.documentos.id,
      tipo: schema.documentos.tipo,
      nombre: schema.documentos.nombre,
      url: schema.documentos.url,
      createdAt: schema.documentos.createdAt,
    })
    .from(schema.documentos)
    .where(
      and(
        eq(schema.documentos.entidadTipo, entidadTipo),
        eq(schema.documentos.entidadId, entidadId),
      ),
    )
    .orderBy(desc(schema.documentos.createdAt));

  return rows.map((row) => ({
    id: row.id,
    tipo: row.tipo,
    nombre: row.nombre,
    url: row.url,
    createdAt: row.createdAt,
  }));
}

// ===================== DOCUMENTOS (listado global) =====================

/** Fila del listado global de documentos (con entidad y quién subió). */
export interface DocumentoListRow {
  id: string;
  tipo: string;
  nombre: string;
  url: string;
  entidadTipo: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  subidoPorNombre: string | null;
  createdAt: string;
}

export interface DocumentosFiltros {
  tipo?: string;
  entidadTipo?: string;
  busqueda?: string;
}

export interface DocumentosPage {
  rows: DocumentoListRow[];
  total: number;
  hasMore: boolean;
}

/**
 * Página del listado global de documentos (transversal a todas las entidades).
 * Respeta la visibilidad por subárbol: un rol acotado solo ve documentos cuya
 * entidad dueña pertenece a su subárbol (por vendedor_id). Resuelve el nombre de
 * la entidad y de quién subió el documento.
 */
export async function getDocumentosPage(
  scope: DashboardScope,
  filtros: DocumentosFiltros,
  opts: { limit: number; offset: number },
): Promise<DocumentosPage> {
  const ambito = await idsEnAmbito(scope);
  const lista = ambito ? sqlIdList(ambito) : null;
  const conds: SQL[] = [];

  if (lista) {
    conds.push(sql`(
      (d.entidad_tipo = 'lead'        AND EXISTS (SELECT 1 FROM leads x         WHERE x.id = d.entidad_id AND x.vendedor_id IN ${lista}))
   OR (d.entidad_tipo = 'cliente'     AND EXISTS (SELECT 1 FROM clientes x      WHERE x.id = d.entidad_id AND x.vendedor_id IN ${lista}))
   OR (d.entidad_tipo = 'oportunidad' AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.id = d.entidad_id AND x.vendedor_id IN ${lista}))
   OR (d.entidad_tipo = 'cotizacion'  AND EXISTS (SELECT 1 FROM cotizaciones x  WHERE x.id = d.entidad_id AND x.vendedor_id IN ${lista}))
   OR (d.entidad_tipo = 'proyecto'    AND EXISTS (SELECT 1 FROM proyectos x     WHERE x.id = d.entidad_id AND x.vendedor_id IN ${lista}))
    )`);
  }
  if (filtros.tipo) conds.push(sql`d.tipo::text = ${filtros.tipo}`);
  if (filtros.entidadTipo) conds.push(sql`d.entidad_tipo::text = ${filtros.entidadTipo}`);
  const q = filtros.busqueda?.trim();
  if (q) conds.push(sql`d.nombre ILIKE ${"%" + q + "%"}`);

  const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

  const [{ total }] = asRows(
    await db.execute(sql`SELECT count(*)::int AS total FROM documentos d ${where}`),
  ).map((r) => ({ total: num(r.total) }));

  const result = await db.execute(sql`
    SELECT d.id::text AS id,
           d.tipo::text AS tipo,
           d.nombre,
           d.url,
           d.entidad_tipo::text AS entidad_tipo,
           d.entidad_id::text AS entidad_id,
           u.nombre AS subido_por_nombre,
           CASE d.entidad_tipo
             WHEN 'lead'        THEN (SELECT nombre FROM leads         WHERE id = d.entidad_id)
             WHEN 'cliente'     THEN (SELECT nombre FROM clientes      WHERE id = d.entidad_id)
             WHEN 'oportunidad' THEN (SELECT nombre FROM oportunidades WHERE id = d.entidad_id)
             WHEN 'cotizacion'  THEN (SELECT folio  FROM cotizaciones  WHERE id = d.entidad_id)
             WHEN 'proyecto'    THEN (SELECT folio  FROM proyectos     WHERE id = d.entidad_id)
           END AS entidad_nombre,
           d.created_at AS created_at
    FROM documentos d
    LEFT JOIN usuarios u ON u.id = d.subido_por
    ${where}
    ORDER BY d.created_at DESC
    LIMIT ${opts.limit} OFFSET ${opts.offset}
  `);

  const rows: DocumentoListRow[] = asRows(result).map((row) => ({
    id: str(row.id),
    tipo: str(row.tipo),
    nombre: str(row.nombre),
    url: str(row.url),
    entidadTipo: strOrNull(row.entidad_tipo),
    entidadId: strOrNull(row.entidad_id),
    entidadNombre: strOrNull(row.entidad_nombre),
    subidoPorNombre: strOrNull(row.subido_por_nombre),
    createdAt: str(row.created_at),
  }));

  return { rows, total, hasMore: opts.offset + rows.length < total };
}

async function getTimelineDeEntidad(
  entidadTipo: (typeof schema.entidadTipo.enumValues)[number],
  entidadId: string,
): Promise<EventoRow[]> {
  const rows = await db
    .select({
      id: schema.eventos.id,
      entidadTipo: schema.eventos.entidadTipo,
      entidadId: schema.eventos.entidadId,
      tipo: schema.eventos.tipo,
      descripcion: schema.eventos.descripcion,
      actor: schema.eventos.actor,
      createdAt: schema.eventos.createdAt,
    })
    .from(schema.eventos)
    .where(
      and(
        eq(schema.eventos.entidadTipo, entidadTipo),
        eq(schema.eventos.entidadId, entidadId),
      ),
    )
    .orderBy(desc(schema.eventos.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: String(row.id),
    entidadTipo: row.entidadTipo,
    entidadId: row.entidadId,
    tipo: row.tipo,
    descripcion: row.descripcion,
    actor: row.actor,
    createdAt: row.createdAt,
  }));
}

/**
 * Actividades de una entidad (con nombre del asignado vía leftJoin a usuarios),
 * ordenadas por estado y vencimiento (nulls al final). `id` (bigint) -> string.
 * `vencida` se calcula en JS: vence_at pasado y aún pendiente.
 */
export async function getActividadesDeEntidad(
  entidadTipo: (typeof schema.entidadTipo.enumValues)[number],
  entidadId: string,
): Promise<ClienteActividadRow[]> {
  const rows = await db
    .select({
      id: schema.actividades.id,
      tipo: schema.actividades.tipo,
      titulo: schema.actividades.titulo,
      descripcion: schema.actividades.descripcion,
      estado: schema.actividades.estado,
      prioridad: schema.actividades.prioridad,
      venceAt: schema.actividades.venceAt,
      completadoAt: schema.actividades.completadoAt,
      asignadoA: schema.actividades.asignadoA,
      asignadoNombre: schema.usuarios.nombre,
      createdAt: schema.actividades.createdAt,
    })
    .from(schema.actividades)
    .leftJoin(
      schema.usuarios,
      eq(schema.actividades.asignadoA, schema.usuarios.id),
    )
    .where(
      and(
        eq(schema.actividades.entidadTipo, entidadTipo),
        eq(schema.actividades.entidadId, entidadId),
      ),
    )
    .orderBy(
      asc(schema.actividades.estado),
      sql`${schema.actividades.venceAt} ASC NULLS LAST`,
    );

  const ahora = new Date();

  return rows.map((row) => ({
    id: String(row.id),
    tipo: row.tipo,
    titulo: row.titulo,
    descripcion: row.descripcion,
    estado: row.estado,
    prioridad: row.prioridad,
    venceAt: row.venceAt,
    completadoAt: row.completadoAt,
    asignadoA: row.asignadoA,
    asignadoNombre: row.asignadoNombre,
    createdAt: row.createdAt,
    vencida:
      row.venceAt != null &&
      new Date(row.venceAt) < ahora &&
      row.estado === "pendiente",
  }));
}

// ===================== AGENDA GLOBAL DE ACTIVIDADES =====================

/** Fila de la agenda global (incluye nombre del asignado y de la entidad). */
export interface ActividadAgendaRow {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  venceAt: string | null;
  completadoAt: string | null;
  asignadoA: string | null;
  asignadoNombre: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  vencida: boolean;
}

export interface ActividadesFiltros {
  estado?: string; // pendiente | completada | cancelada
  tipo?: string; // actividad_tipo
  prioridad?: string; // baja | media | alta
  asignadoA?: string; // uuid | "sin" (sin asignar)
  entidadTipo?: string; // entidad_tipo
  vence?: string; // vencidas | hoy | semana | sin_fecha
  busqueda?: string;
}

export interface ActividadesPage {
  rows: ActividadAgendaRow[];
  total: number;
  hasMore: boolean;
}

export interface ActividadesResumen {
  vencidas: number;
  hoy: number;
  proximas: number;
  sinAsignar: number;
  pendientes: number;
  completadas: number;
}

/**
 * Fragmento de propiedad para roles acotados (vendedor/preventa): la actividad
 * es visible si está asignada a alguien del ámbito (self + descendientes) o si
 * la entidad dueña pertenece al ámbito (por vendedor_id de
 * lead/cliente/oportunidad/cotizacion/proyecto). Para roles globales devuelve
 * null (sin filtro). Se usa en la agenda y el resumen.
 */
async function ownershipActividades(scope: DashboardScope): Promise<SQL | null> {
  const ambito = await idsEnAmbito(scope);
  if (!ambito) return null;
  const lista = sqlIdList(ambito);
  return sql`(
    a.asignado_a IN ${lista}
    OR (a.entidad_tipo = 'lead'        AND EXISTS (SELECT 1 FROM leads x         WHERE x.id = a.entidad_id AND x.vendedor_id IN ${lista}))
    OR (a.entidad_tipo = 'cliente'     AND EXISTS (SELECT 1 FROM clientes x      WHERE x.id = a.entidad_id AND x.vendedor_id IN ${lista}))
    OR (a.entidad_tipo = 'oportunidad' AND EXISTS (SELECT 1 FROM oportunidades x WHERE x.id = a.entidad_id AND x.vendedor_id IN ${lista}))
    OR (a.entidad_tipo = 'cotizacion'  AND EXISTS (SELECT 1 FROM cotizaciones x  WHERE x.id = a.entidad_id AND x.vendedor_id IN ${lista}))
    OR (a.entidad_tipo = 'proyecto'    AND EXISTS (SELECT 1 FROM proyectos x     WHERE x.id = a.entidad_id AND x.vendedor_id IN ${lista}))
  )`;
}

/** Construye las condiciones WHERE (scoping + filtros) de la agenda. */
async function condicionesActividades(
  scope: DashboardScope,
  filtros: ActividadesFiltros,
): Promise<SQL[]> {
  const conds: SQL[] = [];

  const own = await ownershipActividades(scope);
  if (own) conds.push(own);

  if (filtros.estado) conds.push(sql`a.estado::text = ${filtros.estado}`);
  if (filtros.tipo) conds.push(sql`a.tipo::text = ${filtros.tipo}`);
  if (filtros.prioridad) conds.push(sql`a.prioridad::text = ${filtros.prioridad}`);
  if (filtros.entidadTipo) conds.push(sql`a.entidad_tipo::text = ${filtros.entidadTipo}`);

  if (filtros.asignadoA === "sin") {
    conds.push(sql`a.asignado_a IS NULL`);
  } else if (filtros.asignadoA) {
    conds.push(sql`a.asignado_a = ${filtros.asignadoA}::uuid`);
  }

  switch (filtros.vence) {
    case "vencidas":
      conds.push(sql`a.vence_at IS NOT NULL AND a.vence_at < now() AND a.estado = 'pendiente'`);
      break;
    case "hoy":
      conds.push(sql`a.vence_at IS NOT NULL AND a.vence_at::date = current_date`);
      break;
    case "semana":
      conds.push(sql`a.vence_at IS NOT NULL AND a.vence_at >= now() AND a.vence_at <= now() + interval '7 days'`);
      break;
    case "sin_fecha":
      conds.push(sql`a.vence_at IS NULL`);
      break;
    default:
      break;
  }

  const q = filtros.busqueda?.trim();
  if (q) conds.push(sql`a.titulo ILIKE ${"%" + q + "%"}`);

  return conds;
}

/**
 * Página de la agenda global de actividades. Resuelve el nombre del asignado
 * (join a usuarios) y el nombre de la entidad dueña (subconsulta por tipo).
 * Orden: pendientes primero, luego por vencimiento (nulls al final) y prioridad.
 */
export async function getActividadesPage(
  scope: DashboardScope,
  filtros: ActividadesFiltros,
  opts: { limit: number; offset: number },
): Promise<ActividadesPage> {
  const conds = await condicionesActividades(scope, filtros);
  const where = conds.length
    ? sql`WHERE ${sql.join(conds, sql` AND `)}`
    : sql``;

  const [{ total }] = asRows(
    await db.execute(sql`SELECT count(*)::int AS total FROM actividades a ${where}`),
  ).map((r) => ({ total: num(r.total) }));

  const result = await db.execute(sql`
    SELECT a.id::text AS id,
           a.tipo::text AS tipo,
           a.titulo,
           a.descripcion,
           a.estado::text AS estado,
           a.prioridad::text AS prioridad,
           a.vence_at AS vence_at,
           a.completado_at AS completado_at,
           a.asignado_a::text AS asignado_a,
           u.nombre AS asignado_nombre,
           a.entidad_tipo::text AS entidad_tipo,
           a.entidad_id::text AS entidad_id,
           CASE a.entidad_tipo
             WHEN 'lead'        THEN (SELECT nombre FROM leads         WHERE id = a.entidad_id)
             WHEN 'cliente'     THEN (SELECT nombre FROM clientes      WHERE id = a.entidad_id)
             WHEN 'oportunidad' THEN (SELECT nombre FROM oportunidades WHERE id = a.entidad_id)
             WHEN 'cotizacion'  THEN (SELECT folio  FROM cotizaciones  WHERE id = a.entidad_id)
             WHEN 'proyecto'    THEN (SELECT folio  FROM proyectos     WHERE id = a.entidad_id)
           END AS entidad_nombre,
           (a.vence_at IS NOT NULL AND a.vence_at < now() AND a.estado = 'pendiente') AS vencida
    FROM actividades a
    LEFT JOIN usuarios u ON u.id = a.asignado_a
    ${where}
    ORDER BY (a.estado = 'pendiente') DESC,
             a.vence_at ASC NULLS LAST,
             CASE a.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
             a.id DESC
    LIMIT ${opts.limit} OFFSET ${opts.offset}
  `);

  const rows: ActividadAgendaRow[] = asRows(result).map((row) => ({
    id: str(row.id),
    tipo: str(row.tipo),
    titulo: str(row.titulo),
    descripcion: strOrNull(row.descripcion),
    estado: str(row.estado),
    prioridad: str(row.prioridad),
    venceAt: strOrNull(row.vence_at),
    completadoAt: strOrNull(row.completado_at),
    asignadoA: strOrNull(row.asignado_a),
    asignadoNombre: strOrNull(row.asignado_nombre),
    entidadTipo: strOrNull(row.entidad_tipo),
    entidadId: strOrNull(row.entidad_id),
    entidadNombre: strOrNull(row.entidad_nombre),
    vencida: bool(row.vencida),
  }));

  return { rows, total, hasMore: opts.offset + rows.length < total };
}

/** Contadores de la agenda (chips): vencidas, hoy, próximas 7d, sin asignar, etc. */
export async function getActividadesResumen(
  scope: DashboardScope,
): Promise<ActividadesResumen> {
  const own = await ownershipActividades(scope);
  const where = own ? sql`WHERE ${own}` : sql``;

  const [r] = asRows(
    await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE a.estado = 'pendiente' AND a.vence_at IS NOT NULL AND a.vence_at < now())::int AS vencidas,
        count(*) FILTER (WHERE a.estado = 'pendiente' AND a.vence_at IS NOT NULL AND a.vence_at::date = current_date)::int AS hoy,
        count(*) FILTER (WHERE a.estado = 'pendiente' AND a.vence_at > now() AND a.vence_at <= now() + interval '7 days')::int AS proximas,
        count(*) FILTER (WHERE a.estado = 'pendiente' AND a.asignado_a IS NULL)::int AS sin_asignar,
        count(*) FILTER (WHERE a.estado = 'pendiente')::int AS pendientes,
        count(*) FILTER (WHERE a.estado = 'completada')::int AS completadas
      FROM actividades a
      ${where}
    `),
  );

  return {
    vencidas: num(r?.vencidas),
    hoy: num(r?.hoy),
    proximas: num(r?.proximas),
    sinAsignar: num(r?.sin_asignar),
    pendientes: num(r?.pendientes),
    completadas: num(r?.completadas),
  };
}

/** Opción de entidad para el selector del alta de actividad (id + etiqueta). */
export interface EntidadOpcion {
  id: string;
  nombre: string;
}

/**
 * Busca entidades de un tipo por nombre/folio para asociar una actividad, con
 * scoping por vendedor. Devuelve hasta `limit` coincidencias. Los tipos sin
 * dueño comercial directo (contacto/instalacion) no se ofrecen.
 */
export async function buscarEntidadesActividad(
  scope: DashboardScope,
  tipo: string,
  q: string,
  limit = 10,
): Promise<EntidadOpcion[]> {
  const term = `%${q.trim()}%`;
  // Filtro de visibilidad por subárbol (vacío para roles globales).
  const ambito = await idsEnAmbito(scope);
  const fVend = ambito ? sql`AND vendedor_id IN ${sqlIdList(ambito)}` : sql``;

  // Cada rama arma su SELECT (etiqueta = nombre o folio) + filtro de scope.
  let stmt: SQL;
  switch (tipo) {
    case "lead":
      stmt = sql`SELECT id::text AS id, coalesce(nombre, '(sin nombre)') AS nombre FROM leads
                 WHERE nombre ILIKE ${term} ${fVend}
                 ORDER BY created_at DESC LIMIT ${limit}`;
      break;
    case "cliente":
      stmt = sql`SELECT id::text AS id, nombre FROM clientes
                 WHERE nombre ILIKE ${term} ${fVend}
                 ORDER BY created_at DESC LIMIT ${limit}`;
      break;
    case "oportunidad":
      stmt = sql`SELECT id::text AS id, nombre FROM oportunidades
                 WHERE nombre ILIKE ${term} ${fVend}
                 ORDER BY created_at DESC LIMIT ${limit}`;
      break;
    case "cotizacion":
      stmt = sql`SELECT id::text AS id, coalesce(folio, left(id::text, 8)) AS nombre FROM cotizaciones
                 WHERE coalesce(folio, id::text) ILIKE ${term} ${fVend}
                 ORDER BY created_at DESC LIMIT ${limit}`;
      break;
    case "proyecto":
      stmt = sql`SELECT id::text AS id, coalesce(folio, left(id::text, 8)) AS nombre FROM proyectos
                 WHERE coalesce(folio, id::text) ILIKE ${term} ${fVend}
                 ORDER BY created_at DESC LIMIT ${limit}`;
      break;
    default:
      return [];
  }

  return asRows(await db.execute(stmt)).map((row) => ({
    id: str(row.id),
    nombre: str(row.nombre),
  }));
}

/**
 * Resolución de un código postal mexicano al municipio normalizado (catálogo
 * INEGI). Toma la primera fila de `codigos_postales` con ese CP (dMnpio/dEstado
 * + claves c_estado/c_mnpio) y resuelve el `municipios.id` por
 * (clave_estado, clave_mnpio). Si no hay CP devuelve null; si hay CP pero no se
 * encuentra el municipio en el maestro, `municipioId` queda en null.
 */
export interface MunicipioMatch {
  municipioId: number | null;
  municipio: string | null;
  estadoMx: string | null;
}

export async function getMunicipioPorCp(
  cp: string,
): Promise<MunicipioMatch | null> {
  const [codigo] = await db
    .select({
      dMnpio: schema.codigosPostales.dMnpio,
      dEstado: schema.codigosPostales.dEstado,
      cEstado: schema.codigosPostales.cEstado,
      cMnpio: schema.codigosPostales.cMnpio,
    })
    .from(schema.codigosPostales)
    .where(eq(schema.codigosPostales.dCodigo, cp))
    .limit(1);

  if (!codigo) return null;

  let municipioId: number | null = null;
  if (codigo.cEstado && codigo.cMnpio) {
    const [muni] = await db
      .select({ id: schema.municipios.id })
      .from(schema.municipios)
      .where(
        and(
          eq(schema.municipios.claveEstado, codigo.cEstado),
          eq(schema.municipios.claveMnpio, codigo.cMnpio),
        ),
      )
      .limit(1);
    municipioId = muni?.id ?? null;
  }

  return {
    municipioId,
    municipio: codigo.dMnpio,
    estadoMx: codigo.dEstado,
  };
}

/**
 * Lista de cotizaciones filtrada (con nombres de cliente/vendedor vía
 * leftJoin). Scoping por vendedor para roles acotados. Filtros: estado (eq),
 * clienteId (eq), vendedorId (null = sin asignar / isNull), busqueda (ilike
 * folio).
 */
export async function getCotizacionesFiltradas(
  scope: DashboardScope,
  filtros: CotizacionesFiltros = {},
): Promise<CotizacionRow[]> {
  const conds: SQL[] = [];

  const ambito = await idsEnAmbito(scope);
  if (ambito) {
    conds.push(inArray(schema.cotizaciones.vendedorId, ambito));
  }

  if (filtros.estado) conds.push(eq(schema.cotizaciones.estado, filtros.estado));
  if (filtros.clienteId) {
    conds.push(eq(schema.cotizaciones.clienteId, filtros.clienteId));
  }

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.cotizaciones.vendedorId)
        : eq(schema.cotizaciones.vendedorId, filtros.vendedorId),
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conds.push(ilike(schema.cotizaciones.folio, like));
  }

  const rows = await db
    .select({
      id: schema.cotizaciones.id,
      folio: schema.cotizaciones.folio,
      version: schema.cotizaciones.version,
      clienteId: schema.cotizaciones.clienteId,
      clienteNombre: schema.clientes.nombre,
      vendedorId: schema.cotizaciones.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      total: schema.cotizaciones.total,
      estado: schema.cotizaciones.estado,
      validaHasta: schema.cotizaciones.validaHasta,
      createdAt: schema.cotizaciones.createdAt,
    })
    .from(schema.cotizaciones)
    .leftJoin(
      schema.clientes,
      eq(schema.cotizaciones.clienteId, schema.clientes.id),
    )
    .leftJoin(
      schema.usuarios,
      eq(schema.cotizaciones.vendedorId, schema.usuarios.id),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.cotizaciones.createdAt))
    .limit(COTIZACION_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    version: row.version,
    clienteId: row.clienteId,
    clienteNombre: row.clienteNombre,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    total: numOrZero(row.total),
    estado: row.estado,
    validaHasta: row.validaHasta,
    createdAt: row.createdAt,
  }));
}

/**
 * KPIs del listado de cotizaciones (con scoping por rol vía isScoped:
 * vendedor/preventa solo cuentan/suman las suyas). `total` = nº de cotizaciones;
 * `montoAceptado`/`montoEnviadas` = Σ total por estado; `porEstado` arranca con
 * TODAS las claves del enum en 0 y luego suma los conteos. Montos ::float8.
 */
export async function getCotizacionesKpis(
  scope: DashboardScope,
): Promise<CotizacionesKpis> {
  const ambito = await idsEnAmbito(scope);
  const f = ambito
    ? sql`WHERE vendedor_id IN ${sqlIdList(ambito)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      estado::text AS estado,
      count(*)::int AS conteo,
      coalesce(sum(coalesce(total,0)),0)::float8 AS monto
    FROM cotizaciones
    ${f}
    GROUP BY estado
  `);

  const porEstado = schema.cotizacionEstado.enumValues.reduce(
    (acc, estado) => {
      acc[estado] = 0;
      return acc;
    },
    {} as Record<CotizacionEstado, number>,
  );

  let total = 0;
  let montoAceptado = 0;
  let montoEnviadas = 0;

  for (const row of asRows(result)) {
    const estado = str(row.estado) as CotizacionEstado;
    const conteo = num(row.conteo);
    const monto = num(row.monto);
    if (estado in porEstado) porEstado[estado] = conteo;
    total += conteo;
    if (estado === "aceptada") montoAceptado = monto;
    if (estado === "enviada") montoEnviadas = monto;
  }

  return { total, montoAceptado, montoEnviadas, porEstado };
}

/**
 * Detalle de una cotización: cabecera + items (con marca/modelo del equipo vía
 * leftJoin a catálogo) + cliente y oportunidad asociados, además de documentos
 * y timeline de la entidad. Aplica scoping sobre vendedor_id; si no pertenece al
 * rol acotado (o no existe) devuelve null.
 */
export async function getCotizacion(
  scope: DashboardScope,
  id: string,
): Promise<CotizacionDetalle | null> {
  const [cot] = await db
    .select()
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, id))
    .limit(1);

  if (!cot) return null;
  const ambito = await idsEnAmbito(scope);
  if (ambito && (cot.vendedorId == null || !ambito.includes(cot.vendedorId)))
    return null;

  const itemRows = await db
    .select({
      id: schema.cotizacionItems.id,
      equipoId: schema.cotizacionItems.equipoId,
      descripcion: schema.cotizacionItems.descripcion,
      cantidad: schema.cotizacionItems.cantidad,
      precioUnitario: schema.cotizacionItems.precioUnitario,
      importe: schema.cotizacionItems.importe,
      equipoMarca: schema.productos.marca,
      equipoModelo: schema.productos.modelo,
    })
    .from(schema.cotizacionItems)
    .leftJoin(
      schema.productos,
      eq(schema.cotizacionItems.equipoId, schema.productos.id),
    )
    .where(eq(schema.cotizacionItems.cotizacionId, id))
    .orderBy(asc(schema.cotizacionItems.id));

  const items: CotizacionItemRow[] = itemRows.map((row) => ({
    id: String(row.id),
    equipoId: row.equipoId,
    descripcion: row.descripcion,
    cantidad: numOrZero(row.cantidad),
    precioUnitario: numOrZero(row.precioUnitario),
    importe: numOrZero(row.importe),
    equipoMarca: row.equipoMarca,
    equipoModelo: row.equipoModelo,
  }));

  const [cliente, oportunidad, documentos, timeline, calcContext] =
    await Promise.all([
      getClienteResumen(cot.clienteId),
      getOportunidadResumen(cot.oportunidadId),
      getDocumentosDeEntidad("cotizacion", id),
      getTimelineDeEntidad("cotizacion", id),
      getCotizacionCalcContext(id),
    ]);

  return {
    cotizacion: {
      id: cot.id,
      oportunidadId: cot.oportunidadId,
      clienteId: cot.clienteId,
      vendedorId: cot.vendedorId,
      folio: cot.folio,
      version: cot.version,
      capacidadKwp: numOrNull(cot.capacidadKwp),
      paneles: cot.paneles,
      inversor: cot.inversor,
      subtotal: numOrZero(cot.subtotal),
      iva: numOrZero(cot.iva),
      total: numOrZero(cot.total),
      moneda: cot.moneda ?? "MXN",
      produccionAnualKwh: numOrNull(cot.produccionAnualKwh),
      ahorroAnualMxn: numOrNull(cot.ahorroAnualMxn),
      paybackAnios: numOrNull(cot.paybackAnios),
      esquema: cot.esquema,
      estado: cot.estado,
      validaHasta: cot.validaHasta,
      pdfUrl: cot.pdfUrl,
      createdAt: cot.createdAt,
    },
    items,
    cliente,
    oportunidad,
    documentos,
    timeline,
    calcContext,
  };
}

async function getClienteResumen(
  clienteId: string | null,
): Promise<{ id: string; nombre: string; tipoPersona: TipoPersona } | null> {
  if (!clienteId) return null;
  const [row] = await db
    .select({
      id: schema.clientes.id,
      nombre: schema.clientes.nombre,
      tipoPersona: schema.clientes.tipoPersona,
    })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, clienteId))
    .limit(1);
  return row ?? null;
}

async function getOportunidadResumen(
  oportunidadId: string | null,
): Promise<{ id: string; nombre: string; etapa: string } | null> {
  if (!oportunidadId) return null;
  const [row] = await db
    .select({
      id: schema.oportunidades.id,
      nombre: schema.oportunidades.nombre,
      etapa: schema.oportunidades.etapa,
    })
    .from(schema.oportunidades)
    .where(eq(schema.oportunidades.id, oportunidadId))
    .limit(1);
  return row ?? null;
}

/**
 * Reúne el contexto técnico para dimensionar una cotización. Parte de la
 * cotización → cliente (ubicación, tarifa, tipoPersona, lead origen). El consumo
 * y el recibo viven en `leads`: si el cliente tiene `leadOrigenId` se leen de
 * ahí. El `segmento` usa el del lead origen si existe; en su defecto se deriva
 * del tipoPersona (pf_* → "residencial", pm_* → "negocio"). Devuelve null si la
 * cotización no existe o no tiene cliente.
 */
export async function getCotizacionCalcContext(
  cotizacionId: string,
): Promise<CotizacionCalcContext | null> {
  const [cot] = await db
    .select({ clienteId: schema.cotizaciones.clienteId })
    .from(schema.cotizaciones)
    .where(eq(schema.cotizaciones.id, cotizacionId))
    .limit(1);

  if (!cot || !cot.clienteId) return null;

  const [cliente] = await db
    .select({
      tipoPersona: schema.clientes.tipoPersona,
      tarifa: schema.clientes.tarifa,
      municipio: schema.clientes.municipio,
      estadoMx: schema.clientes.estadoMx,
      cp: schema.clientes.cp,
      leadOrigenId: schema.clientes.leadOrigenId,
    })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, cot.clienteId))
    .limit(1);

  if (!cliente) return null;

  let leadSegmento: string | null = null;
  let consumoKwhMes: number | null = null;
  let reciboMxn: number | null = null;

  if (cliente.leadOrigenId) {
    const [lead] = await db
      .select({
        segmento: schema.leads.segmento,
        consumoKwhMes: schema.leads.consumoKwhMes,
        reciboMxn: schema.leads.reciboMxn,
      })
      .from(schema.leads)
      .where(eq(schema.leads.id, cliente.leadOrigenId))
      .limit(1);
    if (lead) {
      leadSegmento = lead.segmento ?? null;
      consumoKwhMes = numOrNull(lead.consumoKwhMes);
      reciboMxn = numOrNull(lead.reciboMxn);
    }
  }

  const segmento =
    leadSegmento ??
    (cliente.tipoPersona.startsWith("pm_") ? "negocio" : "residencial");

  return {
    segmento,
    consumoKwhMes,
    reciboMxn,
    tarifa: cliente.tarifa,
    municipio: cliente.municipio,
    estado: cliente.estadoMx,
    cp: cliente.cp,
  };
}

/**
 * Productos activos como opciones del catálogo (para cotizaciones/proyectos),
 * ordenados por tipo y marca. `tipo` es la clave del tipo (producto_tipos.clave)
 * y `potenciaWp` se extrae de atributos->>'potencia_wp'. `precio` = precio_venta.
 */
export async function getCatalogoDisponible(): Promise<CatalogoOption[]> {
  const rows = await db
    .select({
      id: schema.productos.id,
      tipo: schema.productoTipos.clave,
      marca: schema.productos.marca,
      modelo: schema.productos.modelo,
      potenciaWp: sql<string | null>`${schema.productos.atributos}->>'potencia_wp'`,
      precio: schema.productos.precioVenta,
    })
    .from(schema.productos)
    .innerJoin(
      schema.productoTipos,
      eq(schema.productos.productoTipoId, schema.productoTipos.id),
    )
    .where(eq(schema.productos.activo, true))
    .orderBy(asc(schema.productoTipos.clave), asc(schema.productos.marca));

  return rows.map((row) => ({
    id: row.id,
    tipo: row.tipo,
    marca: row.marca,
    modelo: row.modelo,
    potenciaWp: numOrNull(row.potenciaWp),
    precio: numOrNull(row.precio),
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * PROYECTOS / TRÁMITES / INSTALACIÓN / MATERIALES / PAGOS / MÉTRICAS (D5)
 *
 * Estilo: query builder de Drizzle (eq/ilike/and/or/isNull) + leftJoin para
 * listados y detalle; db.execute(sql`…`) con scoping inyectado para métricas
 * agregadas (igual que getDashboardKpis). Los numeric (mode:'string') se
 * convierten con numOrNull/numOrZero. proyecto_materiales.id es bigint -> se
 * serializa a string en filas y se castea con Number(id) en los where. Scoping
 * por rol vía isScoped(): vendedor/preventa ven SOLO sus proyectos/pagos
 * (proyectos.vendedor_id = userId; pagos vía EXISTS sobre el proyecto dueño).
 * ──────────────────────────────────────────────────────────────────────── */

export type ProyectoFase = (typeof schema.proyectoFase.enumValues)[number];
export type TramiteCfeEstado =
  (typeof schema.tramiteCfeEstado.enumValues)[number];
export type InstalacionEstado =
  (typeof schema.instalacionEstado.enumValues)[number];
export type PagoEstado = (typeof schema.pagoEstado.enumValues)[number];

export interface ProyectosFiltros {
  fase?: ProyectoFase;
  vendedorId?: string | null;
  busqueda?: string;
}

export interface ProyectoRow {
  id: string;
  folio: string | null;
  anio: number;
  clienteId: string | null;
  clienteNombre: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  fase: ProyectoFase;
  capacidadKwp: number | null;
  totalConIva: number | null;
  createdAt: string;
}

export interface TramiteCfeRow {
  id: string;
  estado: TramiteCfeEstado;
  folioCfe: string | null;
  esquema: EsquemaCfe | null;
  estudioRequerido: boolean;
  fechaSolicitud: string | null;
  fechaOficio: string | null;
  fechaMedidor: string | null;
  fechaOperacion: string | null;
  observaciones: string | null;
  updatedAt: string;
}

export interface InstalacionRow {
  id: string;
  cuadrillaId: string | null;
  cuadrillaNombre: string | null;
  estado: InstalacionEstado;
  fechaInicio: string | null;
  fechaFin: string | null;
  avancePct: number;
  notas: string | null;
  updatedAt: string;
}

export interface ProyectoMaterialRow {
  id: string;
  equipoId: string | null;
  equipoMarca: string | null;
  equipoModelo: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  entregado: boolean;
}

export interface ProyectoPagoRow {
  id: string;
  concepto: string;
  monto: number;
  moneda: string;
  estado: PagoEstado;
  fechaProgramada: string | null;
  fechaPagada: string | null;
  metodo: string | null;
  cfdiUuid: string | null;
  vencido: boolean;
  createdAt: string;
}

export interface ProyectoDetalleCabecera {
  id: string;
  folio: string | null;
  anio: number;
  carpetaPath: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  oportunidadId: string | null;
  vendedorId: string | null;
  vendedorNombre: string | null;
  tipoPersona: TipoPersona | null;
  capacidadKwp: number | null;
  nivelTension: NivelTension | null;
  tarifa: string | null;
  esquema: EsquemaCfe | null;
  uvieRequerido: boolean;
  fase: ProyectoFase;
  precioSinIva: number | null;
  totalConIva: number | null;
  costoTotal: number | null;
  margenReal: number | null;
  createdAt: string;
  updatedAt: string;
  cierreAt: string | null;
}

export interface ProyectoDetalle {
  proyecto: ProyectoDetalleCabecera;
  tramite: TramiteCfeRow | null;
  instalacion: InstalacionRow | null;
  materiales: ProyectoMaterialRow[];
  pagos: ProyectoPagoRow[];
  documentos: ClienteDocumentoRow[];
  timeline: EventoRow[];
}

const PROYECTO_QUERY_LIMIT = 500;
const PAGO_QUERY_LIMIT = 500;

/**
 * Lista de proyectos filtrada (con nombres de cliente/vendedor vía leftJoin).
 * Scoping por vendedor para roles acotados. Filtros: fase (eq), vendedorId
 * (null = sin asignar / isNull), busqueda (ilike folio / nombre del cliente).
 */
export async function getProyectosFiltrados(
  scope: DashboardScope,
  filtros: ProyectosFiltros = {},
): Promise<ProyectoRow[]> {
  const conds: SQL[] = [];

  const ambito = await idsEnAmbito(scope);
  if (ambito) {
    conds.push(inArray(schema.proyectos.vendedorId, ambito));
  }

  if (filtros.fase) conds.push(eq(schema.proyectos.fase, filtros.fase));

  if (filtros.vendedorId !== undefined) {
    conds.push(
      filtros.vendedorId === null
        ? isNull(schema.proyectos.vendedorId)
        : eq(schema.proyectos.vendedorId, filtros.vendedorId),
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.proyectos.folio, like),
      ilike(schema.clientes.nombre, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  const rows = await db
    .select({
      id: schema.proyectos.id,
      folio: schema.proyectos.folio,
      anio: schema.proyectos.anio,
      clienteId: schema.proyectos.clienteId,
      clienteNombre: schema.clientes.nombre,
      vendedorId: schema.proyectos.vendedorId,
      vendedorNombre: schema.usuarios.nombre,
      fase: schema.proyectos.fase,
      capacidadKwp: schema.proyectos.capacidadKwp,
      totalConIva: schema.proyectos.totalConIva,
      createdAt: schema.proyectos.createdAt,
    })
    .from(schema.proyectos)
    .leftJoin(schema.clientes, eq(schema.proyectos.clienteId, schema.clientes.id))
    .leftJoin(
      schema.usuarios,
      eq(schema.proyectos.vendedorId, schema.usuarios.id),
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.proyectos.createdAt))
    .limit(PROYECTO_QUERY_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    anio: row.anio,
    clienteId: row.clienteId,
    clienteNombre: row.clienteNombre,
    vendedorId: row.vendedorId,
    vendedorNombre: row.vendedorNombre,
    fase: row.fase,
    capacidadKwp: numOrNull(row.capacidadKwp),
    totalConIva: numOrNull(row.totalConIva),
    createdAt: row.createdAt,
  }));
}

/**
 * Detalle de un proyecto: cabecera + trámite CFE (más reciente), instalación
 * (más reciente), materiales, pagos, documentos (entidad proyecto) y timeline.
 * Aplica scoping: un rol acotado solo ve proyectos propios; si no le pertenece
 * (o no existe) devuelve null.
 */
export async function getProyectoDetalle(
  scope: DashboardScope,
  id: string,
): Promise<ProyectoDetalle | null> {
  const [proyecto] = await db
    .select()
    .from(schema.proyectos)
    .where(eq(schema.proyectos.id, id))
    .limit(1);

  if (!proyecto) return null;
  const ambito = await idsEnAmbito(scope);
  if (ambito && (proyecto.vendedorId == null || !ambito.includes(proyecto.vendedorId)))
    return null;

  const [
    clienteNombre,
    vendedorNombre,
    tramite,
    instalacion,
    materiales,
    pagos,
    documentos,
    timeline,
  ] = await Promise.all([
    getClienteNombre(proyecto.clienteId),
    getVendedorNombre(proyecto.vendedorId),
    getTramiteCfeDeProyecto(id),
    getInstalacionDeProyecto(id),
    getMaterialesDeProyecto(id),
    getPagosDeProyecto(id),
    getDocumentosDeEntidad("proyecto", id),
    getTimelineDeEntidad("proyecto", id),
  ]);

  return {
    proyecto: {
      id: proyecto.id,
      folio: proyecto.folio,
      anio: proyecto.anio,
      carpetaPath: proyecto.carpetaPath,
      clienteId: proyecto.clienteId,
      clienteNombre,
      oportunidadId: proyecto.oportunidadId,
      vendedorId: proyecto.vendedorId,
      vendedorNombre,
      tipoPersona: proyecto.tipoPersona,
      capacidadKwp: numOrNull(proyecto.capacidadKwp),
      nivelTension: proyecto.nivelTension,
      tarifa: proyecto.tarifa,
      esquema: proyecto.esquema,
      uvieRequerido: proyecto.uvieRequerido ?? false,
      fase: proyecto.fase,
      precioSinIva: numOrNull(proyecto.precioSinIva),
      totalConIva: numOrNull(proyecto.totalConIva),
      costoTotal: numOrNull(proyecto.costoTotal),
      margenReal: numOrNull(proyecto.margenReal),
      createdAt: proyecto.createdAt,
      updatedAt: proyecto.updatedAt,
      cierreAt: proyecto.cierreAt,
    },
    tramite,
    instalacion,
    materiales,
    pagos,
    documentos,
    timeline,
  };
}

/** Nombre del cliente (o null). */
async function getClienteNombre(
  clienteId: string | null,
): Promise<string | null> {
  if (!clienteId) return null;
  const [row] = await db
    .select({ nombre: schema.clientes.nombre })
    .from(schema.clientes)
    .where(eq(schema.clientes.id, clienteId))
    .limit(1);
  return row?.nombre ?? null;
}

/** Trámite CFE más reciente (by updatedAt) del proyecto, o null. */
async function getTramiteCfeDeProyecto(
  proyectoId: string,
): Promise<TramiteCfeRow | null> {
  const [row] = await db
    .select({
      id: schema.tramitesCfe.id,
      estado: schema.tramitesCfe.estado,
      folioCfe: schema.tramitesCfe.folioCfe,
      esquema: schema.tramitesCfe.esquema,
      estudioRequerido: schema.tramitesCfe.estudioRequerido,
      fechaSolicitud: schema.tramitesCfe.fechaSolicitud,
      fechaOficio: schema.tramitesCfe.fechaOficio,
      fechaMedidor: schema.tramitesCfe.fechaMedidor,
      fechaOperacion: schema.tramitesCfe.fechaOperacion,
      observaciones: schema.tramitesCfe.observaciones,
      updatedAt: schema.tramitesCfe.updatedAt,
    })
    .from(schema.tramitesCfe)
    .where(eq(schema.tramitesCfe.proyectoId, proyectoId))
    .orderBy(desc(schema.tramitesCfe.updatedAt))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    estado: row.estado,
    folioCfe: row.folioCfe,
    esquema: row.esquema,
    estudioRequerido: row.estudioRequerido ?? false,
    fechaSolicitud: row.fechaSolicitud,
    fechaOficio: row.fechaOficio,
    fechaMedidor: row.fechaMedidor,
    fechaOperacion: row.fechaOperacion,
    observaciones: row.observaciones,
    updatedAt: row.updatedAt,
  };
}

/** Instalación más reciente (by updatedAt) del proyecto, o null. */
async function getInstalacionDeProyecto(
  proyectoId: string,
): Promise<InstalacionRow | null> {
  const [row] = await db
    .select({
      id: schema.instalaciones.id,
      cuadrillaId: schema.instalaciones.cuadrillaId,
      cuadrillaNombre: schema.cuadrillas.nombre,
      estado: schema.instalaciones.estado,
      fechaInicio: schema.instalaciones.fechaInicio,
      fechaFin: schema.instalaciones.fechaFin,
      avancePct: schema.instalaciones.avancePct,
      notas: schema.instalaciones.notas,
      updatedAt: schema.instalaciones.updatedAt,
    })
    .from(schema.instalaciones)
    .leftJoin(
      schema.cuadrillas,
      eq(schema.instalaciones.cuadrillaId, schema.cuadrillas.id),
    )
    .where(eq(schema.instalaciones.proyectoId, proyectoId))
    .orderBy(desc(schema.instalaciones.updatedAt))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    cuadrillaId: row.cuadrillaId,
    cuadrillaNombre: row.cuadrillaNombre,
    estado: row.estado,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    avancePct: row.avancePct ?? 0,
    notas: row.notas,
    updatedAt: row.updatedAt,
  };
}

/**
 * Materiales del proyecto (con marca/modelo del equipo vía leftJoin a
 * catálogo). El esquema NO tiene columna `importe`: se calcula en JS como
 * cantidad * precioUnitario. id bigint -> string.
 */
async function getMaterialesDeProyecto(
  proyectoId: string,
): Promise<ProyectoMaterialRow[]> {
  const rows = await db
    .select({
      id: schema.proyectoMateriales.id,
      equipoId: schema.proyectoMateriales.equipoId,
      equipoMarca: schema.productos.marca,
      equipoModelo: schema.productos.modelo,
      descripcion: schema.proyectoMateriales.descripcion,
      cantidad: schema.proyectoMateriales.cantidad,
      precioUnitario: schema.proyectoMateriales.precioUnitario,
      entregado: schema.proyectoMateriales.entregado,
    })
    .from(schema.proyectoMateriales)
    .leftJoin(
      schema.productos,
      eq(schema.proyectoMateriales.equipoId, schema.productos.id),
    )
    .where(eq(schema.proyectoMateriales.proyectoId, proyectoId))
    .orderBy(asc(schema.proyectoMateriales.id));

  return rows.map((row) => {
    const cantidad = numOrZero(row.cantidad);
    const precioUnitario = numOrZero(row.precioUnitario);
    return {
      id: String(row.id),
      equipoId: row.equipoId,
      equipoMarca: row.equipoMarca,
      equipoModelo: row.equipoModelo,
      descripcion: row.descripcion,
      cantidad,
      precioUnitario,
      importe: cantidad * precioUnitario,
      entregado: row.entregado,
    };
  });
}

/**
 * Pagos del proyecto. `vencido` = estado 'programado' y fecha_programada
 * anterior a la fecha actual.
 */
async function getPagosDeProyecto(
  proyectoId: string,
): Promise<ProyectoPagoRow[]> {
  const rows = await db
    .select({
      id: schema.pagos.id,
      concepto: schema.pagos.concepto,
      monto: schema.pagos.monto,
      moneda: schema.pagos.moneda,
      estado: schema.pagos.estado,
      fechaProgramada: schema.pagos.fechaProgramada,
      fechaPagada: schema.pagos.fechaPagada,
      metodo: schema.pagos.metodo,
      cfdiUuid: schema.pagos.cfdiUuid,
      vencido: sql<boolean>`(${schema.pagos.estado} = 'programado' AND ${schema.pagos.fechaProgramada} < current_date)`,
      createdAt: schema.pagos.createdAt,
    })
    .from(schema.pagos)
    .where(eq(schema.pagos.proyectoId, proyectoId))
    .orderBy(desc(schema.pagos.createdAt));

  return rows.map((row) => ({
    id: row.id,
    concepto: row.concepto,
    monto: numOrZero(row.monto),
    moneda: row.moneda ?? "MXN",
    estado: row.estado,
    fechaProgramada: row.fechaProgramada,
    fechaPagada: row.fechaPagada,
    metodo: row.metodo,
    cfdiUuid: row.cfdiUuid,
    vencido: Boolean(row.vencido),
    createdAt: row.createdAt,
  }));
}

/** Cuadrillas activas (para selects de asignación), ordenadas por nombre. */
export async function getCuadrillasActivas(): Promise<
  { id: string; nombre: string }[]
> {
  const rows = await db
    .select({ id: schema.cuadrillas.id, nombre: schema.cuadrillas.nombre })
    .from(schema.cuadrillas)
    .where(eq(schema.cuadrillas.activa, true))
    .orderBy(asc(schema.cuadrillas.nombre));

  return rows.map((row) => ({ id: row.id, nombre: row.nombre }));
}

export interface PagosFiltros {
  estado?: PagoEstado;
  busqueda?: string;
  soloVencidos?: boolean;
}

export interface PagoRow {
  id: string;
  proyectoId: string | null;
  proyectoFolio: string | null;
  clienteNombre: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  estado: PagoEstado;
  fechaProgramada: string | null;
  fechaPagada: string | null;
  metodo: string | null;
  cfdiUuid: string | null;
  vencido: boolean;
  createdAt: string;
}

export interface PagosTotales {
  programado: number;
  pagado: number;
  vencido: number;
  cancelado: number;
}

export interface PagosData {
  rows: PagoRow[];
  totales: PagosTotales;
}

/** Punto de flujo de cobranza mensual (programado vs pagado). */
export interface PagoFlujoPunto {
  mes: string;
  programado: number;
  pagado: number;
}

/**
 * Flujo de cobranza de los últimos 6 meses (por mes de fecha_programada):
 * `programado` = suma de montos con vencimiento ese mes; `pagado` = suma de los
 * ya cobrados. Respeta el scope por subárbol (vía el proyecto dueño). Incluye
 * meses sin pagos (en cero) para una serie continua.
 */
export async function getPagosFlujo(scope: DashboardScope): Promise<PagoFlujoPunto[]> {
  const ambito = await idsEnAmbito(scope);
  const own = ambito
    ? sql`AND EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = p.proyecto_id AND pr.vendedor_id IN ${sqlIdList(ambito)})`
    : sql``;

  const result = await db.execute(sql`
    WITH meses AS (
      SELECT date_trunc('month', d)::date AS m, to_char(d, 'YYYY-MM') AS mes
      FROM generate_series(
        date_trunc('month', now()) - interval '5 months',
        date_trunc('month', now()),
        interval '1 month'
      ) d
    )
    SELECT meses.mes AS mes,
           coalesce(sum(p.monto), 0)::float8 AS programado,
           coalesce(sum(p.monto) FILTER (WHERE p.estado = 'pagado'), 0)::float8 AS pagado
    FROM meses
    LEFT JOIN pagos p
      ON date_trunc('month', p.fecha_programada) = meses.m ${own}
    GROUP BY meses.mes, meses.m
    ORDER BY meses.m
  `);

  return asRows(result).map((r) => ({
    mes: str(r.mes),
    programado: num(r.programado),
    pagado: num(r.pagado),
  }));
}

/**
 * Pagos filtrados (con folio del proyecto y nombre del cliente vía leftJoin) +
 * totales por estado. Scoping para roles acotados vía EXISTS sobre el proyecto
 * dueño (pagos no tiene vendedor_id). Filtros: estado (eq), soloVencidos
 * (programado + fecha_programada < hoy), busqueda (ilike concepto / folio del
 * proyecto). Orden: vencidos primero, luego desc(createdAt).
 */
export async function getPagosData(
  scope: DashboardScope,
  filtros: PagosFiltros = {},
): Promise<PagosData> {
  const conds: SQL[] = [];

  const ambitoPagos = await idsEnAmbito(scope);
  if (ambitoPagos) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = ${schema.pagos.proyectoId} AND pr.vendedor_id IN ${sqlIdList(ambitoPagos)})`,
    );
  }

  if (filtros.estado) conds.push(eq(schema.pagos.estado, filtros.estado));

  if (filtros.soloVencidos) {
    conds.push(
      sql`(${schema.pagos.estado} = 'programado' AND ${schema.pagos.fechaProgramada} < current_date)`,
    );
  }

  const q = filtros.busqueda?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    const busquedaCond = or(
      ilike(schema.pagos.concepto, like),
      ilike(schema.proyectos.folio, like),
    );
    if (busquedaCond) conds.push(busquedaCond);
  }

  const where = conds.length ? and(...conds) : undefined;
  const vencidoExpr = sql<boolean>`(${schema.pagos.estado} = 'programado' AND ${schema.pagos.fechaProgramada} < current_date)`;

  const rows = await db
    .select({
      id: schema.pagos.id,
      proyectoId: schema.pagos.proyectoId,
      proyectoFolio: schema.proyectos.folio,
      clienteNombre: schema.clientes.nombre,
      concepto: schema.pagos.concepto,
      monto: schema.pagos.monto,
      moneda: schema.pagos.moneda,
      estado: schema.pagos.estado,
      fechaProgramada: schema.pagos.fechaProgramada,
      fechaPagada: schema.pagos.fechaPagada,
      metodo: schema.pagos.metodo,
      cfdiUuid: schema.pagos.cfdiUuid,
      vencido: vencidoExpr,
      createdAt: schema.pagos.createdAt,
    })
    .from(schema.pagos)
    .leftJoin(schema.proyectos, eq(schema.pagos.proyectoId, schema.proyectos.id))
    .leftJoin(schema.clientes, eq(schema.proyectos.clienteId, schema.clientes.id))
    .where(where)
    .orderBy(desc(vencidoExpr), desc(schema.pagos.createdAt))
    .limit(PAGO_QUERY_LIMIT);

  const pagoRows: PagoRow[] = rows.map((row) => ({
    id: row.id,
    proyectoId: row.proyectoId,
    proyectoFolio: row.proyectoFolio,
    clienteNombre: row.clienteNombre,
    concepto: row.concepto,
    monto: numOrZero(row.monto),
    moneda: row.moneda ?? "MXN",
    estado: row.estado,
    fechaProgramada: row.fechaProgramada,
    fechaPagada: row.fechaPagada,
    metodo: row.metodo,
    cfdiUuid: row.cfdiUuid,
    vencido: Boolean(row.vencido),
    createdAt: row.createdAt,
  }));

  const totales = await getPagosTotales(where);

  return { rows: pagoRows, totales };
}

/** Totales por estado (suma de monto) sobre el mismo filtro del listado. */
async function getPagosTotales(where: SQL | undefined): Promise<PagosTotales> {
  const [row] = await db
    .select({
      programado: sql<number>`coalesce(sum(${schema.pagos.monto}) FILTER (WHERE ${schema.pagos.estado} = 'programado'),0)::float8`,
      pagado: sql<number>`coalesce(sum(${schema.pagos.monto}) FILTER (WHERE ${schema.pagos.estado} = 'pagado'),0)::float8`,
      vencido: sql<number>`coalesce(sum(${schema.pagos.monto}) FILTER (WHERE ${schema.pagos.estado} = 'vencido'),0)::float8`,
      cancelado: sql<number>`coalesce(sum(${schema.pagos.monto}) FILTER (WHERE ${schema.pagos.estado} = 'cancelado'),0)::float8`,
    })
    .from(schema.pagos)
    .leftJoin(schema.proyectos, eq(schema.pagos.proyectoId, schema.proyectos.id))
    .where(where);

  return {
    programado: num(row?.programado),
    pagado: num(row?.pagado),
    vencido: num(row?.vencido),
    cancelado: num(row?.cancelado),
  };
}

export interface MetricasFiltros {
  desde?: string;
  hasta?: string;
  vendedorId?: string | null;
}

export interface VentasMensualRow {
  mes: string;
  ingresos: number;
  proyectos: number;
}

export interface ConversionEtapaRow {
  etapa: string;
  conteo: number;
  monto: number;
}

export interface ProyectoFaseMetricaRow {
  fase: string;
  conteo: number;
  total: number;
}

export interface CobranzaRow {
  estado: string;
  monto: number;
}

export interface MetricasResumen {
  ingresosPeriodo: number;
  proyectosNuevos: number;
  tasaConversion: number | null;
  cobranzaPendiente: number;
}

export interface MetricasData {
  ventasMensuales: VentasMensualRow[];
  conversionPipeline: ConversionEtapaRow[];
  proyectosPorFase: ProyectoFaseMetricaRow[];
  cobranza: CobranzaRow[];
  resumen: MetricasResumen;
}

/**
 * Métricas del panel: ventas mensuales (12 meses), conversión del pipeline por
 * etapa, proyectos por fase, cobranza y un resumen. Estilo db.execute(sql`…`)
 * con rango opcional (gte created_at desde / lt hasta) y scoping inyectado como
 * en getDashboardKpis. Montos ::float8, conteos ::int.
 */
export async function getMetricasData(
  scope: DashboardScope,
  filtros: MetricasFiltros = {},
): Promise<MetricasData> {
  // Filtro de vendedor: un filtro explícito (manager eligiendo un vendedor)
  // gana; si no, los roles acotados ven su subárbol y los globales todo.
  // (Métricas es solo-managers por RBAC; el ámbito es defensa en profundidad.)
  const ambito = await idsEnAmbito(scope);
  const explicito =
    filtros.vendedorId !== undefined && filtros.vendedorId !== null
      ? [filtros.vendedorId]
      : null;
  // Un rol acotado no puede escapar su ámbito: el filtro explícito se
  // intersecciona con el subárbol (vacío -> sqlIdList genera "(NULL)").
  const vendedorIds = ambito
    ? explicito
      ? explicito.filter((id) => ambito.includes(id))
      : ambito
    : explicito;
  const lista = vendedorIds ? sqlIdList(vendedorIds) : null;

  const fProy = lista ? sql`AND vendedor_id IN ${lista}` : sql``;
  const fOport = lista ? sql`AND vendedor_id IN ${lista}` : sql``;
  // pagos no tiene vendedor_id -> se acota via el proyecto dueño.
  const fPago = lista
    ? sql`AND EXISTS (SELECT 1 FROM proyectos pr WHERE pr.id = p.proyecto_id AND pr.vendedor_id IN ${lista})`
    : sql``;

  // Rango temporal opcional [desde, hasta) sobre created_at.
  const rProy = sqlRango("created_at", filtros.desde, filtros.hasta);
  const rOport = sqlRango("created_at", filtros.desde, filtros.hasta);

  const [ventasRes, conversionRes, faseRes, cobranzaRes, resumenRes] =
    await Promise.all([
      // Ventas mensuales: 12 meses. ingresos = pagos pagados del mes (por
      // fecha_pagada); proyectos = proyectos creados del mes.
      db.execute(sql`
        SELECT to_char(m.mes, 'YYYY-MM') AS mes,
               coalesce((
                 SELECT sum(p.monto)
                 FROM pagos p
                 WHERE p.estado = 'pagado'
                   AND date_trunc('month', p.fecha_pagada) = m.mes ${fPago}
               ),0)::float8 AS ingresos,
               coalesce((
                 SELECT count(*)
                 FROM proyectos
                 WHERE date_trunc('month', created_at) = m.mes ${fProy}
               ),0)::int AS proyectos
        FROM generate_series(
               date_trunc('month', current_date) - interval '11 months',
               date_trunc('month', current_date),
               interval '1 month'
             ) AS m(mes)
        ORDER BY m.mes ASC
      `),
      // Conversión: oportunidades por etapa en rango.
      db.execute(sql`
        SELECT etapa::text AS etapa,
               count(*)::int AS conteo,
               coalesce(sum(coalesce(monto_estimado,0)),0)::float8 AS monto
        FROM oportunidades
        WHERE true ${rOport} ${fOport}
        GROUP BY etapa
      `),
      // Proyectos por fase en rango.
      db.execute(sql`
        SELECT fase::text AS fase,
               count(*)::int AS conteo,
               coalesce(sum(coalesce(total_con_iva,0)),0)::float8 AS total
        FROM proyectos
        WHERE true ${rProy} ${fProy}
        GROUP BY fase
      `),
      // Cobranza por estado (programado/pagado/vencido).
      db.execute(sql`
        SELECT estado::text AS estado,
               coalesce(sum(monto),0)::float8 AS monto
        FROM pagos p
        WHERE estado IN ('programado','pagado','vencido') ${fPago}
        GROUP BY estado
      `),
      // Resumen del periodo.
      db.execute(sql`
        SELECT
          (SELECT coalesce(sum(p.monto),0)::float8 FROM pagos p
            WHERE p.estado = 'pagado'
              ${sqlRango("p.fecha_pagada", filtros.desde, filtros.hasta)} ${fPago}
          ) AS ingresos_periodo,
          (SELECT count(*)::int FROM proyectos
            WHERE true ${rProy} ${fProy}
          ) AS proyectos_nuevos,
          (SELECT count(*)::int FROM oportunidades
            WHERE etapa = 'ganada' ${rOport} ${fOport}
          ) AS ganadas,
          (SELECT count(*)::int FROM oportunidades
            WHERE etapa = 'perdida' ${rOport} ${fOport}
          ) AS perdidas,
          (SELECT coalesce(sum(monto),0)::float8 FROM pagos p
            WHERE estado IN ('programado','vencido') ${fPago}
          ) AS cobranza_pendiente
      `),
    ]);

  const ventasMensuales = asRows(ventasRes).map((row) => ({
    mes: str(row.mes),
    ingresos: num(row.ingresos),
    proyectos: num(row.proyectos),
  }));

  const conversionPipeline = sortByOrder(
    asRows(conversionRes).map((row) => ({
      etapa: str(row.etapa),
      conteo: num(row.conteo),
      monto: num(row.monto),
    })),
    (r) => r.etapa,
    ETAPA_ORDER,
  );

  const proyectosPorFase = sortByOrder(
    asRows(faseRes).map((row) => ({
      fase: str(row.fase),
      conteo: num(row.conteo),
      total: num(row.total),
    })),
    (r) => r.fase,
    FASE_ORDER,
  );

  const cobranza = asRows(cobranzaRes).map((row) => ({
    estado: str(row.estado),
    monto: num(row.monto),
  }));

  const r = asRows(resumenRes)[0] ?? {};
  const ganadas = num(r.ganadas);
  const perdidas = num(r.perdidas);
  const cerradas = ganadas + perdidas;
  const tasaConversion =
    cerradas === 0 ? null : Math.round((ganadas / cerradas) * 1000) / 10;

  const resumen: MetricasResumen = {
    ingresosPeriodo: num(r.ingresos_periodo),
    proyectosNuevos: num(r.proyectos_nuevos),
    tasaConversion,
    cobranzaPendiente: num(r.cobranza_pendiente),
  };

  return {
    ventasMensuales,
    conversionPipeline,
    proyectosPorFase,
    cobranza,
    resumen,
  };
}

/**
 * Construye un fragmento de rango temporal `AND col >= desde AND col < hasta`
 * para columnas/fechas en consultas db.execute. Cada extremo es opcional; el
 * nombre de columna se interpola como SQL crudo (no es input de usuario).
 */
/** Columnas permitidas para el rango temporal (lista blanca anti-inyección). */
type ColumnaRango = "created_at" | "p.fecha_pagada";

function sqlRango(
  columna: ColumnaRango,
  desde: string | undefined,
  hasta: string | undefined,
): SQL {
  const col = sql.raw(columna);
  const desdeCond = desde ? sql`AND ${col} >= ${desde}` : sql``;
  const hastaCond = hasta ? sql`AND ${col} < ${hasta}` : sql``;
  return sql`${desdeCond} ${hastaCond}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * PRODUCTOS (catálogo unificado) — capa de datos
 *
 * El "tipo" vive en producto_tipos (editable). Cada producto lleva atributos
 * jsonb flexibles por tipo. Reglas: numeric (mode:'string') → number con
 * numOrNull; atributos se devuelve como objeto plano.
 * ───────────────────────────────────────────────────────────────────────── */

export interface ProductoTipoRecord {
  id: string;
  nombre: string;
  clave: string;
  descripcion: string | null;
  activo: boolean;
  /** Nº de productos que apuntan a este tipo (para impedir borrado). */
  productos: number;
  createdAt: string;
  updatedAt: string;
}

/** Opción ligera de tipo para selects del formulario. */
export interface ProductoTipoOption {
  id: string;
  nombre: string;
  clave: string;
}

export interface ProductoRecord {
  id: string;
  productoTipoId: string;
  tipoNombre: string;
  tipoClave: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  marcaId: string | null;
  modelo: string | null;
  descripcion: string | null;
  unidad: string;
  naturaleza: string;
  precioCompra: number | null;
  precioVenta: number | null;
  moneda: string;
  stock: number | null;
  activo: boolean;
  atributos: Record<string, unknown>;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductosFiltros {
  productoTipoId?: string | null;
  busqueda?: string;
  /** Si es true, oculta los productos inactivos. */
  soloActivos?: boolean;
}

export interface ProductosPage {
  rows: ProductoRecord[];
  total: number;
}

/**
 * Tipos de producto con su conteo de productos asociados. Ordenados por nombre.
 * Usado por la administración de tipos (decide si un tipo es borrable).
 */
export async function getProductoTipos(): Promise<ProductoTipoRecord[]> {
  const rows = await db
    .select({
      id: schema.productoTipos.id,
      nombre: schema.productoTipos.nombre,
      clave: schema.productoTipos.clave,
      descripcion: schema.productoTipos.descripcion,
      activo: schema.productoTipos.activo,
      createdAt: schema.productoTipos.createdAt,
      updatedAt: schema.productoTipos.updatedAt,
      productos: sql<number>`(
        SELECT count(*) FROM productos p WHERE p.producto_tipo_id = ${sql.raw("producto_tipos.id")}
      )::int`,
    })
    .from(schema.productoTipos)
    .orderBy(asc(schema.productoTipos.nombre));

  return rows.map((r) => ({ ...r, productos: Number(r.productos) }));
}

/** Tipos activos como opciones para selects (orden alfabético). */
export async function getProductoTiposActivos(): Promise<ProductoTipoOption[]> {
  return db
    .select({
      id: schema.productoTipos.id,
      nombre: schema.productoTipos.nombre,
      clave: schema.productoTipos.clave,
    })
    .from(schema.productoTipos)
    .where(eq(schema.productoTipos.activo, true))
    .orderBy(asc(schema.productoTipos.nombre));
}

/** Condiciones WHERE compartidas por la página y el conteo de productos. */
function productosWhereConds(filtros: ProductosFiltros): SQL[] {
  const conds: SQL[] = [];
  if (filtros.productoTipoId) {
    conds.push(eq(schema.productos.productoTipoId, filtros.productoTipoId));
  }
  if (filtros.soloActivos) {
    conds.push(eq(schema.productos.activo, true));
  }
  const q = filtros.busqueda?.trim();
  if (q) {
    const term = `%${q}%`;
    const busc = or(
      ilike(schema.productos.nombre, term),
      ilike(schema.productos.sku, term),
      ilike(schema.productos.marca, term),
    );
    if (busc) conds.push(busc);
  }
  return conds;
}

function mapProductoRow(row: {
  id: string;
  productoTipoId: string;
  tipoNombre: string;
  tipoClave: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  marcaId: string | null;
  modelo: string | null;
  descripcion: string | null;
  unidad: string;
  naturaleza: string;
  precioCompra: string | null;
  precioVenta: string | null;
  moneda: string;
  stock: number | null;
  activo: boolean;
  atributos: unknown;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
}): ProductoRecord {
  return {
    id: row.id,
    productoTipoId: row.productoTipoId,
    tipoNombre: row.tipoNombre,
    tipoClave: row.tipoClave,
    sku: row.sku,
    nombre: row.nombre,
    marca: row.marca,
    marcaId: row.marcaId,
    modelo: row.modelo,
    descripcion: row.descripcion,
    unidad: row.unidad,
    naturaleza: row.naturaleza,
    precioCompra: numOrNull(row.precioCompra),
    precioVenta: numOrNull(row.precioVenta),
    moneda: row.moneda,
    stock: row.stock,
    activo: row.activo,
    atributos: (row.atributos ?? {}) as Record<string, unknown>,
    imagenUrl: row.imagenUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const productoSelect = {
  id: schema.productos.id,
  productoTipoId: schema.productos.productoTipoId,
  tipoNombre: schema.productoTipos.nombre,
  tipoClave: schema.productoTipos.clave,
  sku: schema.productos.sku,
  nombre: schema.productos.nombre,
  marca: schema.productos.marca,
  marcaId: schema.productos.marcaId,
  modelo: schema.productos.modelo,
  descripcion: schema.productos.descripcion,
  unidad: schema.productos.unidad,
  naturaleza: schema.productos.naturaleza,
  precioCompra: schema.productos.precioCompra,
  precioVenta: schema.productos.precioVenta,
  moneda: schema.productos.moneda,
  stock: schema.productos.stock,
  activo: schema.productos.activo,
  atributos: schema.productos.atributos,
  imagenUrl: schema.productos.imagenUrl,
  createdAt: schema.productos.createdAt,
  updatedAt: schema.productos.updatedAt,
} as const;

/**
 * Página de productos (server-side): cuenta el total que cumple el filtro y
 * devuelve solo la ventana [offset, offset+limit). Filtra por tipo y busca por
 * nombre/sku/marca.
 */
export async function getProductosPage(
  filtros: ProductosFiltros,
  opts: { limit: number; offset: number },
): Promise<ProductosPage> {
  const conds = productosWhereConds(filtros);
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.productos)
    .where(where);

  const rows = await db
    .select(productoSelect)
    .from(schema.productos)
    .innerJoin(
      schema.productoTipos,
      eq(schema.productos.productoTipoId, schema.productoTipos.id),
    )
    .where(where)
    .orderBy(desc(schema.productos.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);

  return { rows: rows.map(mapProductoRow), total: Number(total) };
}

/** Un producto por id (con el nombre/clave de su tipo) o null. */
export async function getProducto(id: string): Promise<ProductoRecord | null> {
  const rows = await db
    .select(productoSelect)
    .from(schema.productos)
    .innerJoin(
      schema.productoTipos,
      eq(schema.productos.productoTipoId, schema.productoTipos.id),
    )
    .where(eq(schema.productos.id, id))
    .limit(1);

  return rows[0] ? mapProductoRow(rows[0]) : null;
}

/** Opción de catálogo para el editor de líneas de paquete. */
export interface ProductoCatalogoOpcion {
  id: string;
  nombre: string;
  tipoNombre: string;
  naturaleza: string;
  precioVenta: number | null;
  unidad: string;
}

/** Productos activos como opciones (para elegir líneas de un paquete). */
export async function getProductosCatalogo(): Promise<ProductoCatalogoOpcion[]> {
  const rows = await db
    .select({
      id: schema.productos.id,
      nombre: schema.productos.nombre,
      tipoNombre: schema.productoTipos.nombre,
      naturaleza: schema.productos.naturaleza,
      precioVenta: schema.productos.precioVenta,
      unidad: schema.productos.unidad,
    })
    .from(schema.productos)
    .innerJoin(schema.productoTipos, eq(schema.productos.productoTipoId, schema.productoTipos.id))
    .where(eq(schema.productos.activo, true))
    .orderBy(asc(schema.productoTipos.nombre), asc(schema.productos.nombre));

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipoNombre: r.tipoNombre,
    naturaleza: r.naturaleza,
    precioVenta: numOrNull(r.precioVenta),
    unidad: r.unidad,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * PAQUETES (bundles para cotizaciones) — capa de datos
 *
 * Un paquete agrupa líneas que referencian productos del catálogo (servicios
 * incluidos). El precio_fijo de la línea es snapshot; el badge de "desviación"
 * se calcula EN VIVO comparando contra productos.precio_venta.
 * ───────────────────────────────────────────────────────────────────────── */

export type PaqueteSegmento = (typeof schema.paqueteSegmento.enumValues)[number];

export interface PaqueteRow {
  id: string;
  nombre: string;
  clave: string;
  descripcion: string | null;
  segmento: PaqueteSegmento;
  capacidadKwp: number | null;
  /** Descuento general del paquete (0–100), aplicado a cada línea al cotizar. */
  descuentoPct: number;
  activo: boolean;
  moneda: string;
  /** Nº de líneas. */
  lineas: number;
  /** Σ cantidad·precio_fijo (sin descuento). */
  subtotal: number;
  /** Total con el descuento general aplicado. */
  total: number;
  /** Nº de líneas con precio_fijo distinto del precio_venta vivo del producto. */
  desactualizadas: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaqueteLineaRow {
  id: string;
  productoId: string;
  productoNombre: string;
  tipoNombre: string;
  naturaleza: string;
  descripcion: string | null;
  cantidad: number;
  precioFijo: number;
  /** Precio de venta vivo del producto (para comparar). */
  precioVentaActual: number | null;
  /** true si precio_fijo ≠ precio_venta actual. */
  desactualizado: boolean;
  orden: number;
}

export interface PaqueteDetalle {
  paquete: PaqueteRow;
  lineas: PaqueteLineaRow[];
}

export interface PaqueteOpcion {
  id: string;
  nombre: string;
  segmento: PaqueteSegmento;
  capacidadKwp: number | null;
  /** Total con descuento aplicado. */
  total: number;
  /** Descuento general del paquete (0–100). */
  descuentoPct: number;
  /** Nº de líneas con precio desactualizado (para avisar al aplicar). */
  desactualizadas: number;
}

export interface PaquetesFiltros {
  segmento?: PaqueteSegmento | null;
  soloActivos?: boolean;
  busqueda?: string;
}

export interface PaquetesPage {
  rows: PaqueteRow[];
  total: number;
}

/** Mapea tipo_persona del cliente al segmento del paquete. */
export function segmentoDeTipoPersona(
  tipoPersona: string | null | undefined,
): PaqueteSegmento {
  if (tipoPersona === "pm_industrial") return "industrial";
  if (tipoPersona === "pm_comercial" || tipoPersona === "pf_actividad_empresarial") {
    return "comercial";
  }
  return "residencial";
}

/**
 * Subconsultas de agregados por paquete (líneas, total, desactualizadas).
 * Nota: la referencia a la PK externa se escribe con sql.raw("paquetes.id")
 * porque Drizzle, dentro de un sql template sobre la tabla principal sin alias,
 * renderiza la columna sin calificar ("id"), lo que sería ambiguo/incorrecto.
 */
const PAQUETE_ID = sql.raw("paquetes.id");
const PAQUETE_DESC = sql.raw("paquetes.descuento_pct");
const paqueteAggregates = {
  lineas: sql<number>`(
    SELECT count(*) FROM paquete_lineas pl WHERE pl.paquete_id = ${PAQUETE_ID}
  )::int`,
  /** Suma de líneas SIN descuento. */
  subtotal: sql<number>`(
    SELECT COALESCE(sum(pl.cantidad * pl.precio_fijo), 0)
    FROM paquete_lineas pl WHERE pl.paquete_id = ${PAQUETE_ID}
  )::float8`,
  /** Total CON el descuento general del paquete aplicado. */
  total: sql<number>`(
    (SELECT COALESCE(sum(pl.cantidad * pl.precio_fijo), 0)
     FROM paquete_lineas pl WHERE pl.paquete_id = ${PAQUETE_ID})
    * (1 - COALESCE(${PAQUETE_DESC}, 0) / 100)
  )::float8`,
  desactualizadas: sql<number>`(
    SELECT count(*) FROM paquete_lineas pl
    JOIN productos pr ON pr.id = pl.producto_id
    WHERE pl.paquete_id = ${PAQUETE_ID}
      AND pl.precio_fijo IS DISTINCT FROM pr.precio_venta
  )::int`,
} as const;

function paquetesWhereConds(filtros: PaquetesFiltros): SQL[] {
  const conds: SQL[] = [];
  if (filtros.segmento) conds.push(eq(schema.paquetes.segmento, filtros.segmento));
  if (filtros.soloActivos) conds.push(eq(schema.paquetes.activo, true));
  const q = filtros.busqueda?.trim();
  if (q) {
    const term = `%${q}%`;
    const busc = or(
      ilike(schema.paquetes.nombre, term),
      ilike(schema.paquetes.clave, term),
    );
    if (busc) conds.push(busc);
  }
  return conds;
}

function mapPaqueteRow(row: {
  id: string;
  nombre: string;
  clave: string;
  descripcion: string | null;
  segmento: PaqueteSegmento;
  capacidadKwp: string | null;
  descuentoPct: string | null;
  activo: boolean;
  moneda: string;
  lineas: number;
  subtotal: number;
  total: number;
  desactualizadas: number;
  createdAt: string;
  updatedAt: string;
}): PaqueteRow {
  return {
    id: row.id,
    nombre: row.nombre,
    clave: row.clave,
    descripcion: row.descripcion,
    segmento: row.segmento,
    capacidadKwp: numOrNull(row.capacidadKwp),
    descuentoPct: numOrZero(row.descuentoPct),
    activo: row.activo,
    moneda: row.moneda,
    lineas: Number(row.lineas),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    desactualizadas: Number(row.desactualizadas),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const paqueteSelect = {
  id: schema.paquetes.id,
  nombre: schema.paquetes.nombre,
  clave: schema.paquetes.clave,
  descripcion: schema.paquetes.descripcion,
  segmento: schema.paquetes.segmento,
  capacidadKwp: schema.paquetes.capacidadKwp,
  descuentoPct: schema.paquetes.descuentoPct,
  activo: schema.paquetes.activo,
  moneda: schema.paquetes.moneda,
  lineas: paqueteAggregates.lineas,
  subtotal: paqueteAggregates.subtotal,
  total: paqueteAggregates.total,
  desactualizadas: paqueteAggregates.desactualizadas,
  createdAt: schema.paquetes.createdAt,
  updatedAt: schema.paquetes.updatedAt,
} as const;

/** Página de paquetes (server-side) con filtros por segmento/estado/búsqueda. */
export async function getPaquetesPage(
  filtros: PaquetesFiltros,
  opts: { limit: number; offset: number },
): Promise<PaquetesPage> {
  const conds = paquetesWhereConds(filtros);
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.paquetes)
    .where(where);

  const rows = await db
    .select(paqueteSelect)
    .from(schema.paquetes)
    .where(where)
    .orderBy(asc(schema.paquetes.nombre))
    .limit(opts.limit)
    .offset(opts.offset);

  return { rows: rows.map(mapPaqueteRow), total: Number(total) };
}

/** Detalle de un paquete con sus líneas resueltas (precio vivo + desviación). */
export async function getPaquete(id: string): Promise<PaqueteDetalle | null> {
  const [cab] = await db
    .select(paqueteSelect)
    .from(schema.paquetes)
    .where(eq(schema.paquetes.id, id))
    .limit(1);
  if (!cab) return null;

  const rows = await db
    .select({
      id: schema.paqueteLineas.id,
      productoId: schema.paqueteLineas.productoId,
      productoNombre: schema.productos.nombre,
      tipoNombre: schema.productoTipos.nombre,
      naturaleza: schema.productos.naturaleza,
      descripcion: schema.paqueteLineas.descripcion,
      cantidad: schema.paqueteLineas.cantidad,
      precioFijo: schema.paqueteLineas.precioFijo,
      precioVentaActual: schema.productos.precioVenta,
      orden: schema.paqueteLineas.orden,
    })
    .from(schema.paqueteLineas)
    .innerJoin(schema.productos, eq(schema.paqueteLineas.productoId, schema.productos.id))
    .innerJoin(schema.productoTipos, eq(schema.productos.productoTipoId, schema.productoTipos.id))
    .where(eq(schema.paqueteLineas.paqueteId, id))
    .orderBy(asc(schema.paqueteLineas.orden), asc(schema.paqueteLineas.id));

  const lineas: PaqueteLineaRow[] = rows.map((r) => {
    const precioFijo = numOrZero(r.precioFijo);
    const precioVentaActual = numOrNull(r.precioVentaActual);
    return {
      id: r.id,
      productoId: r.productoId,
      productoNombre: r.productoNombre,
      tipoNombre: r.tipoNombre,
      naturaleza: r.naturaleza,
      descripcion: r.descripcion,
      cantidad: numOrZero(r.cantidad),
      precioFijo,
      precioVentaActual,
      desactualizado: precioVentaActual !== null && precioVentaActual !== precioFijo,
      orden: r.orden,
    };
  });

  return { paquete: mapPaqueteRow(cab), lineas };
}

/** Paquetes activos como opciones ligeras (para selectores). */
export async function getPaquetesActivos(
  segmento?: PaqueteSegmento,
): Promise<PaqueteOpcion[]> {
  const conds: SQL[] = [eq(schema.paquetes.activo, true)];
  if (segmento) conds.push(eq(schema.paquetes.segmento, segmento));

  const rows = await db
    .select({
      id: schema.paquetes.id,
      nombre: schema.paquetes.nombre,
      segmento: schema.paquetes.segmento,
      capacidadKwp: schema.paquetes.capacidadKwp,
      descuentoPct: schema.paquetes.descuentoPct,
      total: paqueteAggregates.total,
      desactualizadas: paqueteAggregates.desactualizadas,
    })
    .from(schema.paquetes)
    .where(and(...conds))
    .orderBy(asc(schema.paquetes.capacidadKwp));

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    segmento: r.segmento,
    capacidadKwp: numOrNull(r.capacidadKwp),
    descuentoPct: numOrZero(r.descuentoPct),
    total: Number(r.total),
    desactualizadas: Number(r.desactualizadas),
  }));
}

export interface MejorPaqueteResult {
  /** Paquete elegido (el más pequeño que cubre; o el mayor si ninguno cubre). */
  mejor: PaqueteOpcion | null;
  /** true si `mejor` cubre la capacidad objetivo. */
  cubre: boolean;
  /** Candidatos activos del segmento, ordenados por capacidad ascendente. */
  candidatos: PaqueteOpcion[];
}

/**
 * "Paquete que mejor se ajusta": el más PEQUEÑO (por capacidad_kwp) que IGUALA o
 * SUPERA la capacidad objetivo, dentro del segmento. Si ninguno cubre, devuelve
 * el de MAYOR capacidad y marca cubre=false. Devuelve también los candidatos.
 */
export async function getMejorPaquete(args: {
  capacidadKwp: number;
  segmento: PaqueteSegmento;
}): Promise<MejorPaqueteResult> {
  const candidatos = await getPaquetesActivos(args.segmento);
  if (candidatos.length === 0) return { mejor: null, cubre: false, candidatos };

  // candidatos ya viene ordenado por capacidad asc (nulls al final).
  const cubre = candidatos.find(
    (p) => (p.capacidadKwp ?? -Infinity) >= args.capacidadKwp,
  );
  if (cubre) return { mejor: cubre, cubre: true, candidatos };

  // Ninguno cubre: el de mayor capacidad.
  const mayor = candidatos.reduce((a, b) =>
    (b.capacidadKwp ?? 0) > (a.capacidadKwp ?? 0) ? b : a,
  );
  return { mejor: mayor, cubre: false, candidatos };
}

export interface DesviacionLinea {
  paqueteId: string;
  paqueteNombre: string;
  lineaId: string;
  productoNombre: string;
  precioFijo: number;
  precioVentaActual: number;
}

/**
 * Líneas de paquete con desviación de precio (precio_fijo ≠ precio_venta vivo).
 * `soloNuevas`: solo las aún no notificadas (ya_notificado=false) — para el correo.
 */
export async function getDesviacionesPaquetes(
  soloNuevas = false,
): Promise<DesviacionLinea[]> {
  const conds: SQL[] = [
    sql`${schema.paqueteLineas.precioFijo} IS DISTINCT FROM ${schema.productos.precioVenta}`,
  ];
  if (soloNuevas) conds.push(eq(schema.paqueteLineas.yaNotificado, false));

  const rows = await db
    .select({
      paqueteId: schema.paquetes.id,
      paqueteNombre: schema.paquetes.nombre,
      lineaId: schema.paqueteLineas.id,
      productoNombre: schema.productos.nombre,
      precioFijo: schema.paqueteLineas.precioFijo,
      precioVentaActual: schema.productos.precioVenta,
    })
    .from(schema.paqueteLineas)
    .innerJoin(schema.productos, eq(schema.paqueteLineas.productoId, schema.productos.id))
    .innerJoin(schema.paquetes, eq(schema.paqueteLineas.paqueteId, schema.paquetes.id))
    .where(and(...conds))
    .orderBy(asc(schema.paquetes.nombre));

  return rows.map((r) => ({
    paqueteId: r.paqueteId,
    paqueteNombre: r.paqueteNombre,
    lineaId: r.lineaId,
    productoNombre: r.productoNombre,
    precioFijo: numOrZero(r.precioFijo),
    precioVentaActual: numOrZero(r.precioVentaActual),
  }));
}

/* ─────────────────────────────────────────────────────────────────────────
 * CATÁLOGOS · MARCAS — capa de datos
 * ───────────────────────────────────────────────────────────────────────── */

export interface MarcaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarcasFiltros {
  busqueda?: string;
  soloActivas?: boolean;
}

export interface MarcasPage {
  rows: MarcaRow[];
  total: number;
}

/** Página de marcas (server-side) con filtros por búsqueda/estado. */
export async function getMarcasPage(
  filtros: MarcasFiltros,
  opts: { limit: number; offset: number },
): Promise<MarcasPage> {
  const conds: SQL[] = [];
  if (filtros.soloActivas) conds.push(eq(schema.marcas.activo, true));
  const q = filtros.busqueda?.trim();
  if (q) conds.push(ilike(schema.marcas.nombre, `%${q}%`));
  const where = conds.length ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.marcas)
    .where(where);

  const rows = await db
    .select({
      id: schema.marcas.id,
      nombre: schema.marcas.nombre,
      descripcion: schema.marcas.descripcion,
      activo: schema.marcas.activo,
      imagenUrl: schema.marcas.imagenUrl,
      createdAt: schema.marcas.createdAt,
      updatedAt: schema.marcas.updatedAt,
    })
    .from(schema.marcas)
    .where(where)
    .orderBy(asc(schema.marcas.nombre))
    .limit(opts.limit)
    .offset(opts.offset);

  return { rows, total: Number(total) };
}

/** Marcas activas como opciones (id/nombre), orden alfabético. */
export async function getMarcasActivas(): Promise<{ id: string; nombre: string }[]> {
  return db
    .select({ id: schema.marcas.id, nombre: schema.marcas.nombre })
    .from(schema.marcas)
    .where(eq(schema.marcas.activo, true))
    .orderBy(asc(schema.marcas.nombre));
}
