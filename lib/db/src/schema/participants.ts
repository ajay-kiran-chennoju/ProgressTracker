import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const participantsTable = pgTable("participants", {
  slot: varchar("slot", { length: 1 }).primaryKey(),
  name: text("name"),
  pin: text("pin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ParticipantRow = typeof participantsTable.$inferSelect;
