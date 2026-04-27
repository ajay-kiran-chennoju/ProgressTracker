import { Router, type IRouter } from "express";
import { db, categoriesTable, itemsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";
import { listAllParticipants, type Slot } from "../lib/participants";

const router: IRouter = Router();

async function summarizeSlot(slot: Slot) {
  const [cats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categoriesTable)
    .where(eq(categoriesTable.slot, slot));

  const [items] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .where(eq(categoriesTable.slot, slot));

  const dayRows = await db
    .selectDistinct({ date: categoriesTable.date })
    .from(categoriesTable)
    .innerJoin(itemsTable, eq(itemsTable.categoryId, categoriesTable.id))
    .where(eq(categoriesTable.slot, slot));

  const dates = dayRows
    .map((r) => (typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10)))
    .sort();

  const set = new Set(dates);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) streak += 1;
    else if (i === 0) continue;
    else break;
  }

  return {
    totalCategories: Number(cats?.count ?? 0),
    totalItems: Number(items?.count ?? 0),
    activeDays: dates.length,
    currentStreak: streak,
  };
}

router.get("/stats/summary", async (_req, res) => {
  const participants = await listAllParticipants();
  const a = participants.find((p) => p.slot === "A")!;
  const b = participants.find((p) => p.slot === "B")!;

  const [aSum, bSum] = await Promise.all([summarizeSlot("A"), summarizeSlot("B")]);

  const allDays = await db
    .selectDistinct({ date: categoriesTable.date })
    .from(categoriesTable)
    .innerJoin(itemsTable, eq(itemsTable.categoryId, categoriesTable.id));

  res.json({
    a: { participant: a, ...aSum },
    b: { participant: b, ...bSum },
    totalDaysTracked: allDays.length,
  });
});

router.get("/stats/recent-activity", async (req, res) => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const limit = Math.min(50, Math.max(1, query.data.limit ?? 10));

  const participants = await listAllParticipants();
  const nameBySlot = new Map(participants.map((p) => [p.slot, p.name]));

  const rows = await db
    .select({
      itemId: itemsTable.id,
      content: itemsTable.content,
      categoryId: categoriesTable.id,
      categoryTitle: categoriesTable.title,
      date: categoriesTable.date,
      slot: categoriesTable.slot,
      createdAt: itemsTable.createdAt,
    })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .orderBy(desc(itemsTable.createdAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      itemId: r.itemId,
      content: r.content,
      categoryId: r.categoryId,
      categoryTitle: r.categoryTitle,
      date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10),
      slot: r.slot as Slot,
      participantName: nameBySlot.get(r.slot as Slot) ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
