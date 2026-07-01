# Propuesta — Configuraciones/Integraciones en BD (cifradas)

> Objetivo: mover las configuraciones de servicios externos de `.env` a **base de datos**, administrables desde el panel (dinamismo), con los **secretos cifrados** para que un dump de la BD no los filtre. Una sola **llave maestra** permanece en el entorno.

## 1. Principio de seguridad (el modelo de amenaza)
- Los secretos se guardan **cifrados con AES‑256‑GCM**. La **llave de cifrado (`CONFIG_ENC_KEY`) vive solo en el env** del droplet — es el único secreto que NO puede ir a la BD (problema del huevo y la gallina).
- **Si se filtra la BD sola** (dump, backup, acceso de lectura): los secretos son ciphertext inútil sin la llave. ✅ Ganancia principal.
- Si se compromete el **servidor completo** (env incluido): quedan expuestos igual que hoy. No empeora; el objetivo es blindar el vector "acceso a la BD".
- Los secretos **nunca** viajan al cliente: el servicio de config es server‑only y en la UI los campos secretos son *write‑only* (se muestran como "configurado ••••", nunca su valor).

## 2. Entidad propuesta — `integraciones` (una fila por conexión)
Recomendada: **jsonb** para separar ajustes (en claro) de secretos (cifrados). Complementa a `config_parametros` (que seguirá para parámetros de negocio no sensibles: HSP, precios, etc.).

```sql
CREATE TABLE integraciones (
  clave           text PRIMARY KEY,          -- slug: 'chatwoot','m365','meta','n8n','gemini','turnstile','app'
  nombre          text NOT NULL,             -- nombre visible
  descripcion     text,
  activo          boolean NOT NULL DEFAULT true,
  ajustes         jsonb   NOT NULL DEFAULT '{}',  -- NO secreto (urls, ids, model, sender, flags) — en claro
  secretos        jsonb   NOT NULL DEFAULT '{}',  -- cada secreto CIFRADO (ver formato abajo)
  actualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_integraciones_upd BEFORE UPDATE ON integraciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Formato de cada secreto cifrado** (dentro de `secretos`):
```json
{ "api_token": { "ct": "<base64>", "iv": "<base64 12B>", "tag": "<base64 16B>", "v": 1 } }
```
- `ct` ciphertext, `iv` nonce aleatorio por escritura, `tag` authTag GCM, `v` versión de esquema/llave (para rotación).
- **AAD** (dato autenticado adicional) = `"<clave>:<campo>"` → ata el ciphertext a su ubicación (no se puede "mover" un blob cifrado de `m365.client_secret` a otro campo).

Ejemplo de fila (`chatwoot`):
```jsonc
{
  "clave": "chatwoot",
  "ajustes": { "url": "https://chat.jygasoft…", "account_id": "3" },
  "secretos": { "api_token": { "ct": "…", "iv": "…", "tag": "…", "v": 1 } }
}
```

> Alternativa normalizada (si se prefiere): tabla hija `integracion_secretos(integracion_clave, campo, ct, iv, tag, v)` en vez del jsonb `secretos`. Más filas/joins; el jsonb es más simple y suficiente aquí.

## 3. Qué se mueve y qué permanece en `.env`
**Permanece en env (bootstrap / edge / build — no puede ir a BD):**
- `DATABASE_URL` (para poder leer la BD), `CONFIG_ENC_KEY` (nueva llave maestra).
- `AUTH_SECRET`, `AUTH_URL` — NextAuth corre en **middleware (edge)**, sin acceso a Postgres.
- `NODE_ENV` y todas las `NEXT_PUBLIC_*` (se resuelven en build/cliente).

**Se mueve a `integraciones` (server runtime, Node):**
- `chatwoot`: url, account_id + `api_token`, `platform_token`, `webhook_secret`.
- `m365`: tenant_id, client_id, sender, docs_drive_id/site_id/root + `client_secret`.
- `meta`: pixel_id, test_event_code + `capi_token`.
- `n8n`: webhook_url, hmac_kid + `hmac_secret`; `webhook_inbound_secret`.
- `gemini`: model + `api_key`. `turnstile`: + `secret`.
- `app` (parámetros runtime no críticos de edge): OTP_TTL/intentos, RATE_LIMIT_* (si alguno se usa en middleware/edge, se queda en env).

## 4. Cifrado (`lib/config/crypto.ts`)
- `CONFIG_ENC_KEY` = 32 bytes en base64 (generar con `openssl rand -base64 32` o `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). **La generas tú y la pones en el env** (no se inventa aquí; y hay que respaldarla: si se pierde, los secretos son irrecuperables).
- `cifrar(clave, campo, plaintext)` → `{ct,iv,tag,v}` con `crypto.createCipheriv('aes-256-gcm', key, iv)` + `setAAD("clave:campo")`.
- `descifrar(clave, campo, blob)` → plaintext (valida el authTag; si falla, error, no devuelve basura).
- Rotación: soportar `CONFIG_ENC_KEY` + `CONFIG_ENC_KEY_PREV`; acción admin "rotar llave" que descifra con la previa y recifra con la nueva.

## 5. Servicio de configuración (`lib/config/service.ts`)
- `getIntegracion(clave)` → `{ activo, ajustes, secreto(campo) }` con secretos descifrados **bajo demanda**.
- `getSecreto(clave, campo)` / `getAjuste(clave, campo)`.
- **Caché en memoria por proceso** (TTL corto ~60 s) para evitar consultas/descifrados por request; se invalida al guardar (bump de versión / `revalidateTag`).
- **Fallback a `serverEnv`**: si una clave no existe en BD, usa el valor de env. Esto permite migrar **gradualmente y sin downtime**.
- Los gates `xConfigurado()` (chatwoot/m365/meta/n8n…) pasan a preguntar al servicio en vez de a `serverEnv` directamente.

## 6. UI — módulo "Integraciones" (grupo Sistema, solo admin)
- Nuevo módulo RBAC `integraciones` (view/edit = admin). Nav en "Sistema".
- Lista de conexiones con badge de estado (configurada / activa / faltan secretos).
- Editor por conexión: ajustes (inputs de texto) + secretos **write‑only** (input vacío = "no cambiar"; muestra "configurado ••••"). Botón opcional "Probar conexión".
- Nunca se renderiza el valor de un secreto; el server action recibe el nuevo valor, lo cifra y lo guarda.

## 7. Migración / rollout (fases)
- **F1 — Base:** migración `integraciones` + `CONFIG_ENC_KEY` en env + `lib/config/crypto.ts` + `lib/config/service.ts` con **fallback a env**. Sin cambiar consumidores todavía → cero riesgo.
- **F2 — Seed + piloto:** script `db:seed-integraciones` que cifra los valores actuales de env y los inserta; migrar **un** consumidor piloto (p. ej. `chatwoot`) a leer del servicio. Validar.
- **F3 — Migrar el resto:** m365, meta, n8n, gemini, turnstile → leer del servicio. UI de administración.
- **F4 — Limpieza:** quitar del env lo ya migrado (dejar solo bootstrap) y documentar.

## 8. Riesgos / decisiones
- **Respaldo de `CONFIG_ENC_KEY`**: guardarla fuera de la BD (gestor de secretos / bóveda). Si se pierde → secretos irrecuperables (habría que recapturarlos).
- **Edge**: nada que se use en middleware puede depender de la BD; se queda en env.
- **Rendimiento**: caché en memoria evita descifrar en cada request.
- **Auditoría**: `actualizado_por` + `updated_at` (opcional: registrar en `eventos`).
- **Compatibilidad**: `config_parametros` permanece para parámetros de negocio; `integraciones` es solo para conexiones/credenciales.
