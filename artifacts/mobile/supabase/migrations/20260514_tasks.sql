-- ─── Tasks table ──────────────────────────────────────────────────────────────
-- Carry-forward to-do system: tasks that incomplete auto-carry to the next day.
-- Completed tasks are converted to normal item entries.

CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         TEXT        NOT NULL REFERENCES categories(id),
  slot                TEXT        NOT NULL,
  content             TEXT        NOT NULL,
  task_date           DATE        NOT NULL,
  completed           BOOLEAN     NOT NULL DEFAULT false,
  completed_at        TIMESTAMP,
  carried_forward_from DATE,
  is_deleted          BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMP   DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tasks_category_idx
  ON tasks(category_id);

CREATE INDEX IF NOT EXISTS tasks_date_idx
  ON tasks(task_date);

CREATE INDEX IF NOT EXISTS tasks_active_idx
  ON tasks(completed, is_deleted);
