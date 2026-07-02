-- 0023_roles.sql
-- RBAC dinámico (Paso A): roles como datos, POR EMPRESA. Cada rol guarda su matriz
-- de permisos en `permisos` jsonb: { "<modulo>": { "view": bool, "edit": bool } }.
-- El sembrado de los roles base (desde la MATRIX del código) se hace con
-- `pnpm db:seed-roles` (idempotente). El enforcement dinámico (can() desde BD) es
-- el Paso B; por ahora la app sigue usando la matriz en código. Idempotente.

CREATE TABLE IF NOT EXISTS roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  clave      text NOT NULL,                 -- slug estable (admin, gerente, …)
  nombre     text NOT NULL,
  sistema    boolean NOT NULL DEFAULT false, -- roles base: no se pueden eliminar
  activo     boolean NOT NULL DEFAULT true,
  permisos   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_empresa_clave ON roles (empresa_id, clave);
CREATE INDEX IF NOT EXISTS ix_roles_empresa ON roles (empresa_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roles_upd') THEN
    CREATE TRIGGER trg_roles_upd BEFORE UPDATE ON roles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
