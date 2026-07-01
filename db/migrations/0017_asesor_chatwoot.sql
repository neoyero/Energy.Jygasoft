-- =====================================================================
-- 0017 — Asesores especializados con Chatwoot (Fase 1).
-- chatwoot_agent_id pasa a nullable (un asesor puede existir antes de
-- aprovisionarse/enlazarse en Chatwoot). Se agregan email (para invitar/
-- reconciliar por correo) y campos de estado de sincronización. Idempotente.
-- =====================================================================

ALTER TABLE asesores ALTER COLUMN chatwoot_agent_id DROP NOT NULL;

ALTER TABLE asesores ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE asesores ADD COLUMN IF NOT EXISTS chatwoot_estado text NOT NULL DEFAULT 'no_sincronizado';
ALTER TABLE asesores ADD COLUMN IF NOT EXISTS chatwoot_sync_at timestamptz;
ALTER TABLE asesores ADD COLUMN IF NOT EXISTS chatwoot_error text;

-- Índice para reconciliación por correo (match con agentes de Chatwoot).
CREATE INDEX IF NOT EXISTS ix_asesores_email ON asesores (lower(email));
