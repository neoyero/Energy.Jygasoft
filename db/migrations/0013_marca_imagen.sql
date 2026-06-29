-- =====================================================================
-- 0013 — Imagen (logo) de marca, en M365 SharePoint/OneDrive.
-- Mismo patrón que productos: webUrl + item id de Graph. Idempotente.
-- =====================================================================
ALTER TABLE marcas ADD COLUMN IF NOT EXISTS imagen_url text;
ALTER TABLE marcas ADD COLUMN IF NOT EXISTS imagen_item_id text;
