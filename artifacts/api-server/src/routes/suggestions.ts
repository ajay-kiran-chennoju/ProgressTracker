import { Router, type IRouter } from "express";
import { db, categoriesTable, itemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { type Slot } from "../lib/participants";

const router: IRouter = Router();

const VALID_SLOTS = new Set(["A", "B"]);

router.get("/suggestions/categories", async (req, res) => {
  const slot = req.query.slot as string;
  if (!slot || !VALID_SLOTS.has(slot)) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const rows = await db
    .selectDistinct({ title: categoriesTable.title })
    .from(categoriesTable)
    .where(eq(categoriesTable.slot, slot as Slot))
    .orderBy(asc(categoriesTable.title));
  res.json(rows.map((r) => r.title));
});

router.get("/suggestions/items", async (req, res) => {
  const categoryId = req.query.categoryId as string;
  if (!categoryId) {
    res.status(400).json({ error: "categoryId required" });
    return;
  }
  const rows = await db
    .select({ content: itemsTable.content })
    .from(itemsTable)
    .where(eq(itemsTable.categoryId, categoryId))
    .orderBy(asc(itemsTable.content));
  res.json(rows.map((r) => r.content));
});

export default router;
