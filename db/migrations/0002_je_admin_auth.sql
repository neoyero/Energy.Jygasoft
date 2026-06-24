-- =====================================================================
-- 0002 — je-admin: login OTP por correo + rol 'preventa' + ultimo_acceso
-- Idempotente: seguro de re-ejecutar.
-- Nota: en Postgres 12+ ADD VALUE IF NOT EXISTS funciona; el valor nuevo no
-- puede USARSE en la misma transacción (aquí solo se agrega, no se usa).
-- =====================================================================

ALTER TYPE usuario_rol ADD VALUE IF NOT EXISTS 'preventa' AFTER 'vendedor';

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso timestamptz;

-- Códigos de un solo uso (OTP) para login passwordless.
CREATE TABLE IF NOT EXISTS login_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_login_codes_email ON login_codes (lower(email), created_at DESC);
-- Índice parcial para la verificación (solo códigos activos/no consumidos).
CREATE INDEX IF NOT EXISTS ix_login_codes_active ON login_codes (lower(email), created_at DESC) WHERE consumed_at IS NULL;
