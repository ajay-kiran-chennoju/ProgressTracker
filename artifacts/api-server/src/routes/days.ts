import { Router, type IRouter } from "express";
import { db, categoriesTable, itemsTable } from "@workspace/db";
import { eq, and, sql, asc, inArray, or } from "drizzle-orm";
import { GetDayParams, GetActiveDaysParams } from "@workspace/api-zod";
import { listAllParticipants, type Slot } from "../lib/participants";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/days/:date", async (req, res) => {
  const params = GetDayParams.safeParse(req.params);
  if (!params.success || !DATE_RE.test(params.data.date)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  const date = params.data.date;

  const items = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.date, date))
    .orderBy(asc(itemsTable.createdAt));

  const catIdsWithItems = [...new Set(items.map((i) => i.categoryId))];

  const cats = await db
    .select()
    .from(categoriesTable)
    .where(
      or(
        eq(categoriesTable.date, date),
        catIdsWithItems.length > 0 ? inArray(categoriesTable.id, catIdsWithItems) : sql`false`
      )
    )
    .orderBy(asc(categoriesTable.createdAt));

  const itemsByCat = new Map<string, typeof items>();
  for (const item of items) {
    if (!itemsByCat.has(item.categoryId)) itemsByCat.set(item.categoryId, []);
    itemsByCat.get(item.categoryId)!.push(item);
  }

  const buildSide = (slot: Slot) => ({
    categories: cats
      .filter((c) => c.slot === slot)
      .map((c) => ({
        id: c.id,
        title: c.title,
        date: c.date,
        slot: c.slot as Slot,
        items: (itemsByCat.get(c.id) ?? []).map((i) => ({
          id: i.id,
          categoryId: i.categoryId,
          content: i.content,
          date: i.date,
          createdAt: i.createdAt.toISOString(),
        })),
      })),
  });

  const participants = await listAllParticipants();
  const byA = participants.find((p) => p.slot === "A")!;
  const byB = participants.find((p) => p.slot === "B")!;

  res.json({
    date,
    a: { participant: byA, ...buildSide("A") },
    b: { participant: byB, ...buildSide("B") },
  });
});

router.get("/months/:year/:month/active-days", async (req, res) => {
  const params = GetActiveDaysParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid year or month" });
    return;
  }
  const { year, month } = params.data;
  if (month < 1 || month > 12) {
    res.status(400).json({ error: "Month out of range" });
    return;
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  // Active days are days where items were created OR categories were explicitly created
  const itemRows = await db
    .select({
      date: itemsTable.date,
      slot: categoriesTable.slot,
      itemCount: sql<number>`count(${itemsTable.id})::int`,
    })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, itemsTable.categoryId))
    .where(
      and(
        sql`${itemsTable.date} >= ${start}`,
        sql`${itemsTable.date} < ${end}`
      )
    )
    .groupBy(itemsTable.date, categoriesTable.slot);

  const catRows = await db
    .select({
      date: categoriesTable.date,
      slot: categoriesTable.slot,
      itemCount: sql<number>`0::int`,
    })
    .from(categoriesTable)
    .where(
      and(
        sql`${categoriesTable.date} >= ${start}`,
        sql`${categoriesTable.date} < ${end}`
      )
    )
    .groupBy(categoriesTable.date, categoriesTable.slot);

  const rows = [...itemRows, ...catRows];

  const byDate = new Map<string, { aItemCount: number; bItemCount: number }>();
  for (const r of rows) {
    const key = typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10);
    const cur = byDate.get(key) ?? { aItemCount: 0, bItemCount: 0 };
    if (r.slot === "A") cur.aItemCount += Number(r.itemCount);
    else if (r.slot === "B") cur.bItemCount += Number(r.itemCount);
    byDate.set(key, cur);
  }

  const out = Array.from(byDate.entries())
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(out);
});

export default router;
