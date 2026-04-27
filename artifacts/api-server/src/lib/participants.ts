import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Slot = "A" | "B";

export async function ensureSlots(): Promise<void> {
  await db
    .insert(participantsTable)
    .values([
      { slot: "A", name: null },
      { slot: "B", name: null },
    ])
    .onConflictDoNothing();
}

export async function getParticipant(slot: Slot) {
  const rows = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.slot, slot))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAllParticipants() {
  await ensureSlots();
  const rows = await db.select().from(participantsTable);
  const bySlot = new Map(rows.map((r) => [r.slot as Slot, r]));
  return (["A", "B"] as Slot[]).map((slot) => ({
    slot,
    name: bySlot.get(slot)?.name ?? null,
  }));
}
