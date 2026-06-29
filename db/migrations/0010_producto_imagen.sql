-- =====================================================================
-- 0010 — Imagen de producto (almacenada en M365 SharePoint/OneDrive).
-- Guarda el webUrl para mostrar y el item id de Graph para reemplazar/borrar.
-- Idempotente.
-- =====================================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url text;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_item_id text;
