-- Link page templates v2: six new designer templates replace the previous
-- six (classic/minimal/split/bold/cards/neon), plus page background images
-- and per-item thumbnails/item types for the new renderers.
--
-- Template remap (old value -> nearest new design):
--   classic (dark minimal)      -> hardwave  (dark techno)
--   minimal (editorial serif)   -> paper     (paper serif)
--   split   (brand hero)        -> fresh-press (vivid brand green)
--   bold    (neo-brutalist)     -> hardwave  (dark techno)
--   cards   (warm light cards)  -> honeyed   (soft mono blue)
--   neon    (terminal)          -> hardwave  (dark techno)
-- 'paper' becomes the default for pages that never picked one.
--
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not — and the only
-- path for the template value remap, which auto-sync cannot do.

ALTER TABLE link_pages
    ADD COLUMN IF NOT EXISTS background_image_url VARCHAR(500);

-- Scrim opacity (0.0-1.0) applied over background_image_url so text stays
-- readable on busy photos. NULL = the template's built-in default.
ALTER TABLE link_pages
    ADD COLUMN IF NOT EXISTS background_overlay REAL;

ALTER TABLE link_items
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 'link' | 'header' | 'divider' — replaces the fragile icon/url heuristic
-- (isHeadingItem) that guessed heading items from magic marker values.
ALTER TABLE link_items
    ADD COLUMN IF NOT EXISTS item_type VARCHAR(16) NOT NULL DEFAULT 'link';

-- Remap saved templates to the new keys. Re-running is harmless: after the
-- first pass no row matches the old keys any more.
UPDATE link_pages SET template = CASE template
    WHEN 'classic' THEN 'hardwave'
    WHEN 'minimal' THEN 'paper'
    WHEN 'split'   THEN 'fresh-press'
    WHEN 'bold'    THEN 'hardwave'
    WHEN 'cards'   THEN 'honeyed'
    WHEN 'neon'    THEN 'hardwave'
    ELSE template
END;

-- New pages start on the flagship light template.
ALTER TABLE link_pages ALTER COLUMN template SET DEFAULT 'paper';
