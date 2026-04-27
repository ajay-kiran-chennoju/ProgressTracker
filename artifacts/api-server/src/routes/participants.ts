import { Router, type IRouter } from "express";
import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ClaimParticipantBody, RenameParticipantBody, RenameParticipantParams } from "@workspace/api-zod";
import { listAllParticipants, ensureSlots, type Slot } from "../lib/participants";

const router: IRouter = Router();

router.get("/participants", async (_req, res) => {
  const participants = await listAllParticipants();
  res.json(participants);
});

router.post("/participants/claim", async (req, res) => {
  const parsed = ClaimParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  await ensureSlots();
  const { slot, name } = parsed.data;
  const trimmed = name.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  await db
    .insert(participantsTable)
    .values({ slot, name: trimmed })
    .onConflictDoUpdate({
      target: participantsTable.slot,
      set: { name: trimmed, updatedAt: new Date() },
    });
  res.json({ slot, name: trimmed });
});

router.patch("/participants/:slot", async (req, res) => {
  const params = RenameParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const body = RenameParticipantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const slot = params.data.slot as Slot;
  const trimmed = body.data.name.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  await ensureSlots();
  await db
    .update(participantsTable)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(participantsTable.slot, slot));
  res.json({ slot, name: trimmed });
});

export default router;
