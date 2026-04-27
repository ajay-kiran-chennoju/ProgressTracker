import { Router, type IRouter } from "express";
import { db, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ClaimParticipantBody,
  RenameParticipantBody,
  RenameParticipantParams,
  ValidateParticipantPinParams,
  ValidateParticipantPinBody,
  UpdateParticipantPinParams,
  UpdateParticipantPinBody,
} from "@workspace/api-zod";
import { listAllParticipants, ensureSlots, getParticipant, type Slot } from "../lib/participants";

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
  const { slot, name, pin } = parsed.data;
  const trimmed = name.trim();
  if (!trimmed) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  const existing = await getParticipant(slot as Slot);
  if (existing && existing.name && existing.pin) {
    res.status(409).json({ error: "Slot already claimed" });
    return;
  }
  await db
    .insert(participantsTable)
    .values({ slot, name: trimmed, pin })
    .onConflictDoUpdate({
      target: participantsTable.slot,
      set: { name: trimmed, pin, updatedAt: new Date() },
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

router.post("/participants/:slot/validate-pin", async (req, res) => {
  const params = ValidateParticipantPinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const body = ValidateParticipantPinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const slot = params.data.slot as Slot;
  const existing = await getParticipant(slot);
  if (!existing || !existing.pin) {
    res.json({ ok: false, hasPin: false });
    return;
  }
  if (existing.pin !== body.data.pin) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }
  res.json({ ok: true, hasPin: true });
});

router.patch("/participants/:slot/pin", async (req, res) => {
  const params = UpdateParticipantPinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slot" });
    return;
  }
  const body = UpdateParticipantPinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const slot = params.data.slot as Slot;
  const existing = await getParticipant(slot);
  if (!existing || !existing.pin) {
    res.status(401).json({ error: "No PIN set for this slot" });
    return;
  }
  if (existing.pin !== body.data.currentPin) {
    res.status(401).json({ error: "Incorrect current PIN" });
    return;
  }
  await db
    .update(participantsTable)
    .set({ pin: body.data.newPin, updatedAt: new Date() })
    .where(eq(participantsTable.slot, slot));
  res.json({ slot, name: existing.name });
});

export default router;
