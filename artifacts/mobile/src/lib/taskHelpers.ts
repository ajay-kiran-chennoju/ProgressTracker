/**
 * taskHelpers.ts
 *
 * Safe database helpers for the tasks feature.
 */

import { supabase } from './supabase';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SafeTask {
  id: string;
  category_id: string;
  slot: string;
  content: string;
  added_date: string;
  completed_at: string | null;
  is_deleted: boolean;
  created_at: string;
}

// ─── Normalize ────────────────────────────────────────────────────────────────

const normalizeContent = (s: string) => s.trim().toLowerCase();

// ─── FETCH ────────────────────────────────────────────────────────────────────

/**
 * Fetch all pending (incomplete, non-deleted) tasks for a category on a given date.
 */
export async function fetchPendingTasksForCategory(
  categoryId: string,
  taskDate: string,
): Promise<SafeTask[]> {
  const { data, error } = await supabase
    .from('tasks_v2')
    .select('*')
    .eq('category_id', categoryId)
    .lte('added_date', taskDate)
    .is('completed_at', null)
    .eq('is_deleted', false)
    .order('id', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all pending tasks across multiple category IDs.
 * Used by CategoryScreen to aggregate tasks across all same-title/slot instances.
 */
export async function fetchPendingTasksForCategories(
  categoryIds: string[],
  taskDate: string,
): Promise<SafeTask[]> {
  if (categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('tasks_v2')
    .select('*')
    .in('category_id', categoryIds)
    .lte('added_date', taskDate)
    .is('completed_at', null)
    .eq('is_deleted', false)
    .order('id', { ascending: true });

  if (error) throw error;
  return data ?? [];
}


/**
 * Fetch unique task content suggestions for a category (from all dates, not deleted).
 */
export async function fetchTaskSuggestions(categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tasks_v2')
    .select('content')
    .eq('category_id', categoryId)
    .eq('is_deleted', false);

  if (error) throw error;
  const unique = Array.from(new Set(data?.map((t) => t.content) ?? []));
  return unique;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * Safely create a new task, preventing duplicates.
 * Uniqueness: (normalized content + category_id + active incomplete task).
 *
 * Returns the created or existing task.
 */
export async function safeCreateTask(params: {
  categoryId: string;
  slot: string;
  content: string;
  taskDate: string;
}): Promise<SafeTask | null> {
  const { categoryId, slot, content, taskDate } = params;
  const normalised = normalizeContent(content);

  // Duplicate guard: check for active incomplete task with same content/category
  const { data: existing, error: checkErr } = await supabase
    .from('tasks_v2')
    .select('*')
    .eq('category_id', categoryId)
    .is('completed_at', null)
    .eq('is_deleted', false);

  if (checkErr) throw checkErr;

  const duplicate = (existing ?? []).find(
    (t) => normalizeContent(t.content) === normalised,
  );
  if (duplicate) return duplicate;

  // Insert
  const { data: newTask, error } = await supabase
    .from('tasks_v2')
    .insert([
      {
        category_id: categoryId,
        slot,
        content: content.trim(),
        added_date: taskDate,
        completed_at: null,
        is_deleted: false,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return newTask;
}

// ─── COMPLETE ─────────────────────────────────────────────────────────────────

/**
 * Mark a task complete AND insert a normal item entry into the items table.
 * Returns the newly created item.
 */
export async function completeTask(task: SafeTask): Promise<any> {
  const today = format(new Date(), 'yyyy-MM-dd');

  // 1. Mark the task as completed
  const { error: taskErr } = await supabase
    .from('tasks_v2')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', task.id);

  if (taskErr) throw taskErr;

  // 2. Check if a matching item already exists (idempotency)
  const { data: existingItems } = await supabase
    .from('items')
    .select('*')
    .eq('category_id', task.category_id)
    .eq('is_deleted', false);

  const alreadyExists = (existingItems ?? []).find(
    (i) => normalizeContent(i.content) === normalizeContent(task.content),
  );

  if (alreadyExists) return alreadyExists;

  // 3. Create the normal item entry.
  // items table only has: category_id, content, date (is_deleted defaults false).
  const { data: newItem, error: itemErr } = await supabase
    .from('items')
    .insert([
      {
        category_id: task.category_id,
        content: task.content,
        date: today,
      },
    ])
    .select()
    .single();

  if (itemErr) throw itemErr;
  return newItem;
}

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────

/**
 * Soft-delete a task by id.
 */
export async function softDeleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks_v2')
    .update({ is_deleted: true })
    .eq('id', taskId);

  if (error) throw error;
}
