-- ============================================================
-- SAFE SOFT DELETE MIGRATION
-- Run this against your Supabase / PostgreSQL database.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PART 1: Add is_deleted columns (idempotent)
-- ────────────────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- PART 2: Back-fill existing rows (safe — only affects NULLs)
-- ────────────────────────────────────────────────────────────

UPDATE categories SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE items       SET is_deleted = false WHERE is_deleted IS NULL;

-- ────────────────────────────────────────────────────────────
-- PART 3: Partial unique index — prevents duplicate active categories
--
-- UNIQUE(title, date, slot) WHERE is_deleted = false
--
-- This means:
--   • Two active categories with the same title+date+slot → rejected by DB.
--   • A deleted + active category with same title+date+slot → allowed (safe).
--   • Multiple deleted rows with same title+date+slot     → allowed (audit trail).
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS categories_unique_active_idx
  ON categories (lower(title), date, slot)
  WHERE is_deleted = false;

-- ────────────────────────────────────────────────────────────
-- PART 4: Performance indexes
-- ────────────────────────────────────────────────────────────

-- Already exists from schema, but listed for completeness:
-- CREATE INDEX IF NOT EXISTS categories_slot_date_idx ON categories (slot, date);

-- Filter index for fast soft-delete exclusion on categories
CREATE INDEX IF NOT EXISTS categories_is_deleted_idx
  ON categories (is_deleted)
  WHERE is_deleted = false;

-- Filter index for fast soft-delete exclusion on items
CREATE INDEX IF NOT EXISTS items_is_deleted_idx
  ON items (is_deleted)
  WHERE is_deleted = false;

-- Composite index: category fetch by slot + date, excluding deleted
CREATE INDEX IF NOT EXISTS categories_slot_date_not_deleted_idx
  ON categories (slot, date)
  WHERE is_deleted = false;

-- Composite index: items by category_id, excluding deleted
CREATE INDEX IF NOT EXISTS items_category_not_deleted_idx
  ON items (category_id)
  WHERE is_deleted = false;

-- Composite index: items by date, excluding deleted
CREATE INDEX IF NOT EXISTS items_date_not_deleted_idx
  ON items (date)
  WHERE is_deleted = false;

-- ────────────────────────────────────────────────────────────
-- PART 5: Foreign key safety
--
-- The existing FK is:
--   items.category_id REFERENCES categories(id) ON DELETE CASCADE
--
-- With soft deletes, we do NOT want ON DELETE CASCADE to fire —
-- we never hard-delete categories, so this is safe as-is.
--
-- If you ever need to hard-delete for GDPR/data purge, the
-- cascade will correctly remove child items. This is intentional.
-- ────────────────────────────────────────────────────────────

-- No FK change required. Document that hard deletes are forbidden
-- from application code; use soft delete (is_deleted = true) only.

-- ────────────────────────────────────────────────────────────
-- PART 6: Validation queries
-- Run these after migration to confirm correctness.
-- ────────────────────────────────────────────────────────────

-- Confirm no active duplicate categories exist:
-- SELECT title, date, slot, COUNT(*) as n
-- FROM categories
-- WHERE is_deleted = false
-- GROUP BY lower(title), date, slot
-- HAVING COUNT(*) > 1;

-- Confirm is_deleted columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name IN ('categories', 'items')
--   AND column_name = 'is_deleted';

-- Confirm indexes were created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('categories', 'items')
-- ORDER BY indexname;
