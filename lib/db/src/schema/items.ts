import { pgTable, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { categoriesTable } from "./categories";

export const itemsTable = pgTable(
  "items",
  {
    id: varchar("id", { length: 32 }).primaryKey().default(sql`replace(gen_random_uuid()::text, '-', '')`),
    categoryId: varchar("category_id", { length: 32 })
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    byCategory: index("items_category_idx").on(table.categoryId),
  }),
);

export type ItemRow = typeof itemsTable.$inferSelect;
