import { pgTable, varchar, text, timestamp, date, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const categoriesTable = pgTable(
  "categories",
  {
    id: varchar("id", { length: 32 }).primaryKey().default(sql`replace(gen_random_uuid()::text, '-', '')`),
    slot: varchar("slot", { length: 1 }).notNull(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    bySlotDate: index("categories_slot_date_idx").on(table.slot, table.date),
  }),
);

export type CategoryRow = typeof categoriesTable.$inferSelect;
