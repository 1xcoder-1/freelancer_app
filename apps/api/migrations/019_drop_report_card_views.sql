-- 018: profile tracking system removed — the portfolio is templates + content
-- only. The lifetime view counter lived here; analytics history never did.

ALTER TABLE report_cards DROP COLUMN IF EXISTS views_count;
