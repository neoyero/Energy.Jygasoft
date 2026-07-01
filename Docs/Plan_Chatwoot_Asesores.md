# Plan — Módulo de Asesores especializado con Chatwoot

> Objetivo: administrar **todo lo de asesores/agentes desde el panel de JYGASOFT Energy** (alta, vinculación usuario↔agente, inbox/equipo, zonas/segmentos, activar/desactivar) sin duplicar altas en Chatwoot. Integración **bidireccional**: *outbound* (web → Chatwoot API para aprovisionar) e *inbound* (Chatwoot → web vía webhook para sincronizar conversaciones/contactos con leads). Chatwoot está self-hosted en el mismo droplet.

## 0. Estado actual (base sobre la que se construye)
- Tabla `asesores` (`db/schema.ts`): `usuario_id` (FK→usuarios), `nombre`, **`chatwoot_agent_id` (int, NOT NULL — hoy es un placeholder que se captura a mano)**, `ms_email`, `telefono`, `zonas[]`, `segmentos[]`, `activo`, `asignaciones`.
- Un **vendedor puede ser asesor** vía `asesores.usuario_id = usuarios.id`. La asignación de leads solo permite asesores activos (`asignarLead` valida `asesores.activo && usuarios.activo`).
- **No existe** cliente HTTP a Chatwoot, ni variables `CHATWOOT_*`, ni webhook inbound, ni mapeo conversación↔lead. Solo se guarda el `chatwoot_agent_id` a mano.
- Patrón de integración a reutilizar: `lib/m365/sharepoint.ts` (gate `xConfigurado()`, token en env, `fetch` autenticado, retorno `{ok,error}` sin lanzar). Webhooks existentes en `app/api/webhooks/` (n8n, paquetes) → mismo patrón para el de Chatwoot.

## 1. Definiciones de Chatwoot (a confirmar contra la versión instalada)
Chatwoot expone dos APIs relevantes; ambas autentican con el header **`api_access_token`** (no `Bearer`):

- **Application API** (por cuenta; token = *Access Token* de un usuario admin de la cuenta, en Perfil → Access Token):
  - Agentes: `GET|POST|PATCH|DELETE /api/v1/accounts/{account_id}/agents` — crear agente **invita por correo** a un usuario a la cuenta (campos `name`, `email`, `role: agent|administrator`).
  - Inboxes: `GET /api/v1/accounts/{account_id}/inboxes`.
  - Equipos: `GET|POST /api/v1/accounts/{account_id}/teams` (+ team members).
  - Contactos: `POST /api/v1/accounts/{account_id}/contacts`, búsqueda `GET .../contacts/search`.
  - Conversaciones: `GET .../conversations`, asignación de agente `POST .../conversations/{id}/assignments`.
  - Webhooks: `GET|POST|DELETE /api/v1/accounts/{account_id}/webhooks` (registrar el callback por API en vez de a mano).
- **Platform API** (super-admin; token = *Platform App* en la consola de super admin):
  - `POST /platform/api/v1/users` — crear usuario Chatwoot **sin invitación por correo** (devuelve id + access_token).
  - `POST /platform/api/v1/accounts/{account_id}/account_users` — asociar usuario↔cuenta con rol.
  - Necesario solo si se quiere crear el agente por completo desde el web sin flujo de invitación por correo.

> Recomendación: empezar con **Application API** (crear/invitar agentes, listar inboxes/equipos, registrar webhook). El **Platform API** queda como opción (Fase 2) si se quiere alta 100% sin correo.

## 2. Credenciales / entorno (NO se inventan — las provees tú)
Añadir a `lib/env.ts` (serverSchema) y `.env`:
- `CHATWOOT_URL` — base del droplet (p. ej. `https://chat.jygasoft…`).
- `CHATWOOT_ACCOUNT_ID` — id numérico de la cuenta.
- `CHATWOOT_API_TOKEN` — Access Token de un admin de la cuenta (Application API).
- `CHATWOOT_PLATFORM_TOKEN` — *(opcional, Fase 2)* Platform App token.
- `CHATWOOT_WEBHOOK_SECRET` — secreto propio para validar el inbound (Chatwoot no firma los webhooks; se valida por token en la URL/query).

Gate `chatwootConfigurado()` = URL + ACCOUNT_ID + API_TOKEN presentes. Si no está configurado, el módulo **degrada** al modo manual actual (capturar `chatwoot_agent_id`) sin romperse.

## 3. Cambios de modelo de datos (migración idempotente)
Sobre `asesores`:
- `chatwoot_agent_id` → **nullable** (un asesor puede existir antes de aprovisionar en Chatwoot; o quedar pendiente).
- `email` (text) — correo del agente en Chatwoot (default: `usuarios.email` del vinculado o `ms_email`). Chatwoot necesita email para crear/invitar.
- `chatwoot_estado` (text: `no_sincronizado | invitado | activo | error`), `chatwoot_sync_at` (timestamptz), `chatwoot_error` (text) — estado de aprovisionamiento.
- `inbox_ids` (int[]), `team_id` (int) — *(opcional)* asignación de bandejas/equipos gestionada desde el web.

Sobre `leads` *(Fase 3, inbound)*:
- `chatwoot_contact_id` (int), `chatwoot_conversation_id` (int) — enlazar el lead con su contacto/conversación en Chatwoot.

Mantener sincronía de los 3 artefactos (migración `db/migrations/00XX_*.sql` + `SQL/Esquema_BD_Postgres.sql` + `SQL/CHANGELOG_BD.md`).

## 4. Cliente Chatwoot (`lib/chatwoot/client.ts`)
Espejo del patrón M365:
- `chatwootConfigurado(): boolean`.
- `cwFetch(path, init)` — base URL + header `api_access_token`, manejo de error `{ok,error}` sin lanzar, log acotado.
- Application API: `listarAgentes()`, `crearAgente({name,email,role})`, `eliminarAgente(id)`, `listarInboxes()`, `listarEquipos()`, `buscarContacto(query)`, `crearContacto(...)`, `registrarWebhook(url,eventos)`, `listarWebhooks()`.
- Platform API *(Fase 2)*: `crearUsuarioPlataforma(...)`, `asociarUsuarioCuenta(...)`.

## 5. Backend — acciones (outbound)
En `lib/admin/actions.ts` (perm `usuarios:edit`, homologado con el resto):
- `crearAsesor` (extendido): si `chatwootConfigurado()` y se marca "aprovisionar", llama `crearAgente` (invita por correo) y guarda `chatwoot_agent_id` + `chatwoot_estado`. Si no, modo manual (id a mano). 
- `actualizarAsesor`: edita datos locales; opcional propagar nombre/rol a Chatwoot.
- `toggleAsesorActivo`: activa/desactiva local (no borra el agente).
- `sincronizarAsesoresChatwoot()`: **reconciliación** — trae agentes de Chatwoot (`listarAgentes`) y hace *match por email* para backfillear `chatwoot_agent_id`/estado de los asesores existentes (clave para no re-crear lo que ya tienes en el droplet).
- `provisionarAsesor(id)` / `reintentarSync(id)`: reintenta el alta/enlace de un asesor concreto.
- *(opcional)* `asignarInboxEquipo(id, inboxIds, teamId)`.

## 6. Inbound — webhook (lo que viste en Chatwoot)
- Ruta `POST /api/webhooks/chatwoot/route.ts` (patrón de `app/api/webhooks/n8n`): valida `CHATWOOT_WEBHOOK_SECRET` (segmento/query de la URL, ya que Chatwoot no firma), parsea el evento y despacha:
  - `contact_created` / `contact_updated` → upsert/enlazar lead por email/teléfono.
  - `conversation_created` → enlazar conversación ↔ lead (guardar `chatwoot_conversation_id`), y opcional crear lead si no existe.
  - `message_created` → registrar actividad/nota en el lead (traza de conversación).
  - `conversation_status_changed` → reflejar en el lead (p. ej. resuelto).
- **Registro del webhook**: dos vías —
  1. Manual (pantalla que mostraste): pegar `URL de Webhook = https://<jygasoft>/api/webhooks/chatwoot?token=<CHATWOOT_WEBHOOK_SECRET>` y marcar eventos `conversation_created`, `message_created`, `contact_created`, `contact_updated`, `conversation_status_changed`.
  2. Automática por API (`registrarWebhook`) desde un botón "Conectar Chatwoot" en el panel.

## 7. UI (homologada con el resto del panel)
- **`AsesorForm` en `Modal` (crear/editar)** — igual que Usuarios/Marcas/Campañas. Campos: usuario vinculado (un vendedor puede ser asesor), nombre, email (Chatwoot), teléfono, zonas, segmentos, activo, inbox/equipo *(opcional)*, y un **toggle "Aprovisionar en Chatwoot"** + **badge de estado de sync** (no sincronizado / invitado / activo / error) con botón "Reintentar".
- **`AsesoresView`** (`DataTable`): agente Chatwoot (#id + estado), usuario vinculado, email, zonas/segmentos, asignaciones, activo; acciones Editar / Activar-Desactivar / Reintentar sync.
- Botón **"Sincronizar con Chatwoot"** (reconciliación) y, si se opta por registro automático, **"Conectar webhook"**.
- Ubicación: sigue dentro de `/je-admin/usuarios` (sección Asesores) o se promueve a pestaña propia dentro de esa página.

## 8. Fases de ejecución
- **F1 — Base + reconciliación (bajo riesgo):** env + `lib/chatwoot/client.ts` + gate; migración (nullable + estado); homologar `AsesorForm` a modal; `sincronizarAsesoresChatwoot()` (match por email, backfill del `chatwoot_agent_id` que ya tienes). *No cambia el flujo manual; lo hace opcional.*
- **F2 — Aprovisionamiento outbound:** crear/invitar agente desde el alta; asignar inbox/equipo; (opcional) Platform API para alta sin correo.
- **F3 — Inbound (webhook):** `/api/webhooks/chatwoot` + columnas `chatwoot_contact_id/conversation_id` en leads + enlace conversación↔lead + traza de mensajes como actividad.
- **F4 — Conversación en contexto:** en la ficha del lead, ver estado de la conversación y "Abrir en Chatwoot"; historial de mensajes.

Cada fase con `typecheck`/`build` en verde y revisión adversarial (por ser integración externa + datos de cliente).

## 9. Riesgos / decisiones
- **Credenciales**: sin `CHATWOOT_URL`/token no se puede hacer nada real; se piden a ti (no se inventan). Guardar en env del droplet.
- **Duplicados**: la reconciliación por email evita crear agentes que ya existen en tu Chatwoot local.
- **Seguridad del webhook**: Chatwoot no firma; se valida por secreto en la URL + validación de forma del payload.
- **Rol de token**: Application API alcanza para agentes/inboxes/webhooks; Platform API solo si se quiere alta sin invitación por correo.
- **Idempotencia**: el inbound debe ser idempotente (mismo evento repetido no duplica leads/actividades).
