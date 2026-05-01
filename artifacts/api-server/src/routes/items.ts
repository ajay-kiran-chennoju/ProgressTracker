import { Router, type IRouter } from "express";
import { db, categoriesTable, itemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateItemBody,
  UpdateItemBody,
  UpdateItemParams,
  DeleteItemParams,
  DeleteItemQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/items/suggestions", async (req, res) => {
  const { categoryId } = req.query;
  if (!categoryId || typeof categoryId !== "string") {
    res.status(400).json({ error: "categoryId required" });
    return;
  }
  
  // Find the category to get its title and slot
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId))
    .limit(1);

  if (!cat) {
    res.json([]);
    return;
  }

  // Find all categories with the same title and slot
  const normTitle = cat.title.trim().toLowerCase();
  const allSlotCats = await db
    .select({ id: categoriesTable.id, title: categoriesTable.title })
    .from(categoriesTable)
    .where(eq(categoriesTable.slot, cat.slot));
    
  const matchingCatIds = allSlotCats
    .filter(c => c.title.trim().toLowerCase() === normTitle)
    .map(c => c.id);

  if (matchingCatIds.length === 0) {
    res.json([]);
    return;
  }

  // Fetch items for all matching category IDs
  const items = await db
    .select({ content: itemsTable.content })
    .from(itemsTable)
    .where(sql`${itemsTable.categoryId} IN (${sql.join(matchingCatIds.map(id => sql`${id}`), sql`, `)})`);
    
  res.json(items.map(i => i.content));
});

router.post("/items", async (req, res) => {
  const body = CreateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const trimmed = body.data.content.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Content cannot be empty" });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, body.data.categoryId))
    .limit(1);
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (cat.slot !== body.data.slot) {
    res.status(403).json({ error: "Cannot add to other participant's category" });
    return;
  }
  const [row] = await db
    .insert(itemsTable)
    .values({ categoryId: body.data.categoryId, content: trimmed, date: body.data.date })
    .returning();
  res.status(201).json({
    id: row.id,
    categoryId: row.categoryId,
    content: row.content,
    date: row.date,
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/items/:itemId", async (req, res) => {
  const params = UpdateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body", details: body.error.issues });
    return;
  }
  const trimmed = body.data.content.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Content cannot be empty" });
    return;
  }
  const [item] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, params.data.itemId))
    .limit(1);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, item.categoryId))
    .limit(1);
  if (!cat || cat.slot !== body.data.slot) {
    res.status(403).json({ error: "Cannot edit other participant's item" });
    return;
  }
  const [updated] = await db
    .update(itemsTable)
    .set({ content: trimmed })
    .where(eq(itemsTable.id, params.data.itemId))
    .returning();
  res.json({
    id: updated.id,
    categoryId: updated.categoryId,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/items/:itemId", async (req, res) => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const query = DeleteItemQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const [item] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, params.data.itemId))
    .limit(1);
  if (!item) {
    res.status(204).end();
    return;
  }
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, item.categoryId))
    .limit(1);
  if (!cat || cat.slot !== query.data.slot) {
    res.status(403).json({ error: "Cannot delete other participant's item" });
    return;
  }
  await db.delete(itemsTable).where(eq(itemsTable.id, params.data.itemId));
  res.status(204).end();
});

export default router;
