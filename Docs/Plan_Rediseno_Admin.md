# Plan de rediseño — Panel `je-admin`

> Objetivo: llevar el panel de "funcional pero plano" a un back-office **profesional, visual y con funcionalidades completas**, manteniendo el RBAC y el login OTP ya construidos (Fase 0).

## Decisiones fijadas
- **Gráficas:** Recharts.
- **Tema:** claro **+ oscuro** (las variables dark ya existen en `globals.css`).
- **Navegación:** sidebar **agrupado y colapsable con iconos**.
- **Orden de build:** D1 → D5 (abajo).

---

## A. Sistema de diseño

### A1. Principios
- CRM **denso pero calmado**; jerarquía visual clara (estilo Linear/Notion/dashboards modernos).
- **Marca presente**: verde profundo `#002612`, verde `#206c3b`, dorado `#f5b301`, menta; acentos con propósito sobre neutros.
- **Color = significado**: cada estado (lead, etapa, fase, pago) con el mismo color semántico en todo el panel.
- **Acción a un clic**: acciones rápidas por fila/tarjeta; detalle en *drawer* lateral sin perder contexto.

### A2. Shell de la aplicación
- **Sidebar agrupado y colapsable** (a "rail" de iconos), secciones por área:
  - *Comercial*: Dashboard, Leads, Pipeline, Clientes, Cotizaciones, Actividades.
  - *Operaciones*: Proyectos, Trámite CFE, Instalaciones, Documentos.
  - *Finanzas*: Pagos, Métricas.
  - *Catálogo* · *Marketing* (Campañas) · *Sistema* (Usuarios).
  - Filtrado por rol (RBAC existente).
- **Top bar**: breadcrumbs, **búsqueda global (⌘K)**, notificaciones (tareas vencidas), avatar + menú, indicador de rol.
- **Page header** consistente: título + descripción + acciones + tabs.

### A3. Tokens (sobre `globals.css`)
- Neutros admin (grises cálidos), sombras suaves, radios `xl/2xl`, espaciado consistente.
- **Colores de estado** semánticos (success/warning/danger/info + mapeo por enum).
- Tipografía con escala clara; números tabulares. Modo oscuro. Densidad cómoda.

### A4. Kit de componentes (`components/admin/ui/`)
`StatCard` (icono + número + tendencia + sparkline) · `DataTable` (orden, filtros, paginación, empty state, acciones de fila, selección masiva) · `Badge/StatusPill` (por enum) · `KanbanBoard` (drag & drop) · `PageHeader` · `FilterBar` · `Drawer`/`Modal` · `Timeline` · `Charts` (barras/línea/dona/sparkline con Recharts) · `EmptyState` · `Toast` · `Avatar` · `Tabs` · `Stepper`.

---

## B. Plan por módulo

| Módulo | Visualización | Funcionalidades |
|---|---|---|
| **Dashboard** | KPIs con tendencia + sparkline; leads en el tiempo; embudo de conversión; pipeline por etapa; proyectos por fase; ingresos/forecast; "mis tareas de hoy"; actividad reciente. Widgets por rol. | Rango de fechas; drill-down a cada módulo. |
| **Leads** | Tabla rica + toggle Kanban; score con barra de color; canal con icono. | Filtros (estado/canal/vendedor/fecha/score), búsqueda, asignar a vendedor, acciones masivas, drawer de detalle con timeline, *scoping* por vendedor. |
| **Pipeline (Oportunidades)** | Kanban drag & drop por etapa; forecast ponderado; valor por columna. | Mover etapa arrastrando, detalle de deal, vincular cotización, registrar actividad. |
| **Clientes** | Vista 360°: ficha (datos fiscales, CFE) + pestañas (contactos, oportunidades, proyectos, documentos, historial). | Crear/editar, contactos, buscar por RFC/nombre. |
| **Cotizaciones** | Constructor con partidas desde catálogo; subtotal/IVA/total en vivo; estado con badge; versiones. | Crear desde oportunidad, items, estados (borrador→enviada→aceptada), PDF. |
| **Proyectos** | Stepper de fases (input→…→garantía); tarjetas de avance; semáforos. | Avanzar fase (bitácora en `eventos`); sub-secciones: Trámite CFE, Instalación, Materiales, Documentos, Pagos. |
| **Trámite CFE** | Línea de tiempo de estados con fechas. | Actualizar estado/fechas/observaciones. |
| **Instalaciones** | Barra de avance; calendario; asignación de cuadrilla. | Editar avance, fechas, evidencias. |
| **Pagos** | Calendario/timeline; vencidos resaltados; gráfica de flujo. | Programar, marcar pagado, CFDI. |
| **Catálogo** | Tabla con specs; filtros por tipo; marca/imagen. | CRUD de equipos. |
| **Campañas** | Métricas (gasto, leads, CPL); leads por campaña; atribución UTM. | CRUD, vincular leads. |
| **Actividades** | Lista + calendario; "mis pendientes"; vencimientos. | Crear/asignar/completar, recordatorios. |
| **Métricas** | Reportes: ventas, conversión por etapa, proyectos por fase, cobranza. | Filtros por fecha/vendedor, export. |
| **Usuarios** *(hecho)* | Mejora visual: avatares, último acceso, estado. | Alta/edición/activar (ya implementado). |

---

## C. Fases de ejecución (con agentes especializados)
- **D1 — Fundación de diseño**: tokens + shell (sidebar agrupado/colapsable + topbar + búsqueda) + kit de componentes. *Cambia el ~80% de la percepción.*
- **D2 — Dashboard** con KPIs + gráficas reales (Recharts).
- **D3 — Leads + Pipeline** (tabla rica + kanban + filtros + drawer).
- **D4 — Clientes 360 + Cotizaciones**.
- **D5 — Operaciones (Proyectos/CFE/Instalaciones) + Pagos + Métricas**.

Cada fase con `typecheck`/`build` en verde y revisión (code-reviewer). Módulos acotados delegados a agentes.
