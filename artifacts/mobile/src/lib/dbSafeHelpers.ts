/**
 * dbSafeHelpers.ts
 *
 * Centralised, safe database helpers for the mobile app.
 *
 * SAFETY RULES enforced here:
 *  1. NEVER hard-delete — every destructive action is a soft delete (is_deleted = true).
 *  2. EVERY fetch filters  is_deleted = false  so deleted rows never appear in the UI.
 *  3. EVERY delete / update targets the row by its unique `id` — never by title, date, or slot alone.
 *  4. All destructive actions are logged via console.warn so they are traceable in logs.
 *  5. Restore helpers are provided so any accidental deletion can be undone.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SafeCategory {
  id: string;
  slot: string;
  date: string;
  title: string;
  created_at: string;
  is_deleted: boolean;
}

export interface SafeItem {
  id: string;
  category_id: string;
  content: string;
  date: string;
  created_at: string;
  is_deleted: boolean;
}

// ─── CATEGORY HELPERS ─────────────────────────────────────────────────────────

/**
 * Fetch all active (non-deleted) categories for a given slot and date.
 */
export async function safeFetchCategoriesForDay(
  slot: string,
  date: string,
): Promise<SafeCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slot', slot)
    .eq('date', date)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all active (non-deleted) categories for a slot across all dates.
 * Used by HomeScreen for calendar dots and stats.
 */
export async function safeFetchAllCategories(slot: string): Promise<SafeCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, title, date, slot')
    .eq('slot', slot)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch unique category title suggestions for a slot (excluding deleted).
 */
export async function safeFetchCategoryTitleSuggestions(slot: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('title')
    .eq('slot', slot)
    .eq('is_deleted', false);

  if (error) throw error;
  const uniqueTitles = Array.from(new Set(data?.map((c) => c.title) ?? []));
  return uniqueTitles;
}

/**
 * Guard: check if an active category with the same title + date + slot already exists.
 * Returns the existing row if found, null otherwise.
 */
export async function findExistingActiveCategory(
  title: string,
  date: string,
  slot: string,
): Promise<SafeCategory | null> {
  const normalised = title.trim().toLowerCase();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slot', slot)
    .eq('date', date)
    .eq('is_deleted', false);

  if (error) throw error;

  const match = (data ?? []).find(
    (c) => c.title.trim().toLowerCase() === normalised,
  );
  return match ?? null;
}

/**
 * SAFE SOFT DELETE — marks a category as deleted by its unique `id`.
 * Does NOT cascade to items; use safeDeleteItemsByCategoryId if needed.
 *
 * Safety: targets exact row by id only.
 */
export async function safeDeleteCategory(
  categoryId: string,
  participantSlot: string,
): Promise<void> {
  console.warn('[SAFE DELETE] category', { categoryId, participantSlot });

  // Verify ownership before deleting
  const { data: cat, error: fetchErr } = await supabase
    .from('categories')
    .select('id, slot')
    .eq('id', categoryId)
    .eq('is_deleted', false)
    .single();

  if (fetchErr || !cat) {
    console.warn('[SAFE DELETE] category not found or already deleted:', categoryId);
    return;
  }

  if (cat.slot !== participantSlot) {
    throw new Error('[SAFE DELETE] Unauthorized: cannot delete another participant\'s category');
  }

  const { error } = await supabase
    .from('categories')
    .update({ is_deleted: true })
    .eq('id', categoryId); // ← id-only target, never title/date/slot alone

  if (error) throw error;
}

/**
 * RESTORE a soft-deleted category by its unique `id`.
 */
export async function restoreCategory(categoryId: string): Promise<void> {
  console.warn('[RESTORE] category', { categoryId });

  const { error } = await supabase
    .from('categories')
    .update({ is_deleted: false })
    .eq('id', categoryId);

  if (error) throw error;
}

// ─── ITEM HELPERS ─────────────────────────────────────────────────────────────

/**
 * Fetch all active (non-deleted) items for a specific date.
 */
export async function safeFetchItemsForDate(date: string): Promise<SafeItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('date', date)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all active (non-deleted) items for a specific category id.
 * Targets by category_id (FK), never by title.
 */
export async function safeFetchItemsByCategoryId(categoryId: string): Promise<SafeItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      category:categories!inner(id, title, date, slot, is_deleted)
    `)
    .eq('category_id', categoryId)          // ← scoped by exact category ID
    .eq('is_deleted', false)                // ← exclude soft-deleted items
    .eq('category.is_deleted', false)       // ← exclude items of deleted categories
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch unique item content suggestions for a category id (excluding deleted).
 */
export async function safeFetchItemContentSuggestions(categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('items')
    .select('content')
    .eq('category_id', categoryId)
    .eq('is_deleted', false);

  if (error) throw error;
  const unique = Array.from(new Set(data?.map((i) => i.content) ?? []));
  return unique;
}

/**
 * Count active (non-deleted) items for a list of category ids.
 */
export async function safeCountItemsByCategoryIds(categoryIds: string[]): Promise<number> {
  if (categoryIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .in('category_id', categoryIds)
    .eq('is_deleted', false);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch all unique dates that have active categories or items for a given slot.
 * This is the root fix for Activity Calendar highlighting.
 */
export async function safeFetchActiveDates(slot: string): Promise<string[]> {
  // 1. Get unique dates from categories
  const { data: catDates, error: catErr } = await supabase
    .from('categories')
    .select('date')
    .eq('slot', slot)
    .eq('is_deleted', false);

  if (catErr) throw catErr;

  // 2. Get unique dates from items (need to join with categories to filter by slot)
  const { data: itemDates, error: itemErr } = await supabase
    .from('items')
    .select('date, category:categories!inner(slot, is_deleted)')
    .eq('category.slot', slot)
    .eq('category.is_deleted', false)
    .eq('is_deleted', false);

  if (itemErr) throw itemErr;

  // 3. Merge and deduplicate
  const allDates = new Set<string>();
  catDates?.forEach((c: any) => allDates.add(c.date.slice(0, 10)));
  itemDates?.forEach((i: any) => allDates.add(i.date.slice(0, 10)));

  return Array.from(allDates).sort();
}

/**
 * SAFE SOFT DELETE — marks an item as deleted by its unique `id`.
 *
 * Safety: targets exact row by id only — never by content or category title.
 */
export async function safeDeleteItem(
  itemId: string,
  participantSlot: string,
): Promise<void> {
  console.warn('[SAFE DELETE] item', { itemId, participantSlot });

  // Verify ownership via the parent category's slot
  const { data: item, error: fetchErr } = await supabase
    .from('items')
    .select(`id, category:categories!inner(slot)`)
    .eq('id', itemId)
    .eq('is_deleted', false)
    .single();

  if (fetchErr || !item) {
    console.warn('[SAFE DELETE] item not found or already deleted:', itemId);
    return;
  }

  const catSlot = (item as any).category?.slot;
  if (catSlot !== participantSlot) {
    throw new Error('[SAFE DELETE] Unauthorized: cannot delete another participant\'s item');
  }

  const { error } = await supabase
    .from('items')
    .update({ is_deleted: true })
    .eq('id', itemId); // ← id-only target

  if (error) throw error;
}

/**
 * RESTORE a soft-deleted item by its unique `id`.
 */
export async function restoreItem(itemId: string): Promise<void> {
  console.warn('[RESTORE] item', { itemId });

  const { error } = await supabase
    .from('items')
    .update({ is_deleted: false })
    .eq('id', itemId);

  if (error) throw error;
}
