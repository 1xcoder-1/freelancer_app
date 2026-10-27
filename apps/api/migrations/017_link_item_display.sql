-- 017: per-item display override for link pages ("icon" | "card" | NULL = auto).
-- init_db auto-adds missing columns in dev; this makes it explicit for prod.

ALTER TABLE link_items ADD COLUMN IF NOT EXISTS display VARCHAR(16);
