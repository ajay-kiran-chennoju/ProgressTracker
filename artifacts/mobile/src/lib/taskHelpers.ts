/**
 * taskHelpers.ts
 *
 * Safe database helpers for the tasks feature.
 *
 * Carry-forward rules enforced here:
 *  - Uniqueness: (content normalized + category_id + task_date) prevents duplicates.
 *  - Carry-forward: incomplete tasks from previous days are cloned once for today.
 *  - Completion: marks task done and inserts a normal item entry.
 *  - Soft-delete: is_deleted pattern mirrors the items/categories pattern.
 */

import { supabase } from './supabase';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SafeTask {
  id: string;
  category_id: string;
  slot: string;
  content: string;
  task_date: string;
  completed: boolean;
  completed_at: string | null;
  carried_forward_from: string | null;
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
    .from('tasks')
    .select('*')
    .eq('category_id', categoryId)
    .eq('task_date', taskDate)
    .eq('completed', false)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch unique task content suggestions for a category (from all dates, not deleted).
 */
export async function fetchTaskSuggestions(categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tasks')
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
 * Uniqueness: (normalized content + category_id + task_date + completed=false).
 *
 * Returns the created or existing task.
 */
export async function safeCreateTask(params: {
  categoryId: string;
  slot: string;
  content: string;
  taskDate: string;
  carriedForwardFrom?: string;
}): Promise<SafeTask | null> {
  const { categoryId, slot, content, taskDate, carriedForwardFrom } = params;
  const normalised = normalizeContent(content);

  // Duplicate guard
  const { data: existing, error: checkErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('category_id', categoryId)
    .eq('task_date', taskDate)
    .eq('completed', false)
    .eq('is_deleted', false);

  if (checkErr) throw checkErr;

  const duplicate = (existing ?? []).find(
    (t) => normalizeContent(t.content) === normalised,
  );
  if (duplicate) return duplicate;

  // Insert
  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert([
      {
        category_id: categoryId,
        slot,
        content: content.trim(),
        task_date: taskDate,
        completed: false,
        carried_forward_from: carriedForwardFrom ?? null,
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
    .from('tasks')
    .update({ completed: true, completed_at: new Date().toISOString() })
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

  // 3. Create the normal item entry
  const { data: newItem, error: itemErr } = await supabase
    .from('items')
    .insert([
      {
        category_id: task.category_id,
        content: task.content,
        date: today,
        slot: task.slot,
        is_deleted: false,
      },
    ])
    .select()
    .single();

  if (itemErr) throw itemErr;
  return newItem;
}

// ─── CARRY-FORWARD ────────────────────────────────────────────────────────────

/**
 * Carry-forward logic:
 * Finds all incomplete tasks from BEFORE today and creates clones for today
 * if they don't already exist (uniqueness by content + category_id + today).
 *
 * Called once on app load / day screen focus.
 */
export async function carryForwardIncompleteTasks(today: string): Promise<void> {
  // Find all incomplete tasks from before today
  const { data: oldTasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('*')
    .lt('task_date', today)
    .eq('completed', false)
    .eq('is_deleted', false);

  if (fetchErr) throw fetchErr;
  if (!oldTasks || oldTasks.length === 0) return;

  // Fetch today's existing pending tasks to prevent duplicates
  const { data: todayTasks, error: todayErr } = await supabase
    .from('tasks')
    .select('content, category_id')
    .eq('task_date', today)
    .eq('completed', false)
    .eq('is_deleted', false);

  if (todayErr) throw todayErr;

  const todaySet = new Set(
    (todayTasks ?? []).map(
      (t) => `${t.category_id}:::${normalizeContent(t.content)}`,
    ),
  );

  const toInsert = oldTasks
    .filter((t) => {
      const key = `${t.category_id}:::${normalizeContent(t.content)}`;
      return !todaySet.has(key);
    })
    .map((t) => ({
      category_id: t.category_id,
      slot: t.slot,
      content: t.content,
      task_date: today,
      completed: false,
      carried_forward_from: t.carried_forward_from ?? t.task_date,
      is_deleted: false,
    }));

  if (toInsert.length === 0) return;

  const { error: insertErr } = await supabase.from('tasks').insert(toInsert);
  if (insertErr) throw insertErr;

  console.log(`[CARRY-FORWARD] Carried ${toInsert.length} tasks to ${today}`);
}

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────

/**
 * Soft-delete a task by id.
 */
export async function softDeleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ is_deleted: true })
    .eq('id', taskId);

  if (error) throw error;
}
