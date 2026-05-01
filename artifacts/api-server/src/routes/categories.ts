import { Router, type IRouter } from "express";
import { db, categoriesTable, itemsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  GetCategoryParams,
  DeleteCategoryParams,
  DeleteCategoryQueryParams,
} from "@workspace/api-zod";
import { listAllParticipants, type Slot } from "../lib/participants";

const router: IRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^[AB]$/;

router.get("/categories/suggestions", async (req, res) => {
  const { slot } = req.query;
  let baseQuery = db.selectDistinct({ title: categoriesTable.title }).from(categoriesTable);
  
  if (slot && typeof slot === "string") {
    baseQuery = baseQuery.where(eq(categoriesTable.slot, slot)) as any;
  }
  
  const titles = await baseQuery;
  res.json(titles.map(t => t.title));
});

router.get("/categories/unique", async (req, res) => {
  const { slot } = req.query;
  if (!slot || typeof slot !== "string") {
    res.status(400).json({ error: "Slot required" });
    return;
  }
  
  const allCats = await db
    .select({ id: categoriesTable.id, title: categoriesTable.title, createdAt: categoriesTable.createdAt })
    .from(categoriesTable)
    .where(eq(categoriesTable.slot, slot))
    .orderBy(asc(categoriesTable.createdAt));
  
  const uniqueMap = new Map();
  for (const c of allCats) {
    const norm = c.title.trim().toLowerCase();
    if (!uniqueMap.has(norm)) {
      uniqueMap.set(norm, { id: c.id, title: c.title });
    }
  }
  
  res.json(Array.from(uniqueMap.values()));
});

router.post("/categories", async (req, res) => {
  const body = CreateCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const { slot, date, title } = body.data;
  if (!DATE_RE.test(date)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  const trimmed = title.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }
  const [row] = await db
    .insert(categoriesTable)
    .values({ slot, date, title: trimmed })
    .returning();
  res.status(201).json({
    id: row.id,
    title: row.title,
    date: row.date,
    slot: row.slot as Slot,
    itemCount: 0,
  });
});

router.get("/categories/:categoryId", async (req, res) => {
  const params = GetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, params.data.categoryId))
    .limit(1);
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  // Find all categories for this slot with the same normalized title
  const normTitle = cat.title.trim().toLowerCase();
  const allSlotCats = await db
    .select({ id: categoriesTable.id, title: categoriesTable.title })
    .from(categoriesTable)
    .where(eq(categoriesTable.slot, cat.slot));
    
  const matchingCatIds = allSlotCats
    .filter(c => c.title.trim().toLowerCase() === normTitle)
    .map(c => c.id);

  let items: any[] = [];
  if (matchingCatIds.length > 0) {
    // Drizzle currently has limited support for IN with empty arrays, but length is > 0 here
    items = await db
      .select()
      .from(itemsTable)
      .where(sql`${itemsTable.categoryId} IN (${sql.join(matchingCatIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(sql`${itemsTable.createdAt} desc`);
  }

  const participants = await listAllParticipants();
  const participant = participants.find((p) => p.slot === cat.slot)!;

  res.json({
    category: {
      id: cat.id,
      title: cat.title,
      date: cat.date,
      slot: cat.slot as Slot,
      items: items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        content: i.content,
        date: i.date,
        createdAt: i.createdAt.toISOString(),
      })),
    },
    participant,
  });
});

router.patch("/categories/:categoryId", async (req, res) => {
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, params.data.categoryId))
    .limit(1);
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (cat.slot !== body.data.slot) {
    res.status(403).json({ error: "Cannot modify other participant's category" });
    return;
  }
  const trimmed = body.data.title.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }
  const [updated] = await db
    .update(categoriesTable)
    .set({ title: trimmed })
    .where(eq(categoriesTable.id, params.data.categoryId))
    .returning();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemsTable)
    .where(eq(itemsTable.categoryId, updated.id));
  res.json({
    id: updated.id,
    title: updated.title,
    date: updated.date,
    slot: updated.slot as Slot,
    itemCount: Number(count),
  });
});

router.delete("/categories/:categoryId", async (req, res) => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const query = DeleteCategoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, params.data.categoryId))
    .limit(1);
  if (!cat) {
    res.status(204).end();
    return;
  }
  if (cat.slot !== query.data.slot) {
    res.status(403).json({ error: "Cannot delete other participant's category" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.categoryId));
  res.status(204).end();
});

export default router;
