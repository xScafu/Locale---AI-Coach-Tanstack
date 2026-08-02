import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  activateSetup,
  createSetup,
  deleteSetup,
  getSetupById,
  getSetupsByCar,
  updateSetup,
} from "../repositories/setup.repository";

import { parseSvmFile } from "../services/setup-import.service";
import { getLatestSetupChanges } from "../repositories/message.repository";

const setups = new Hono();

// Restituisce solo un'anteprima parsata: non salva nulla finché
// l'utente non conferma dalla UI (i valori sono "suggerimenti", non
// certezze - vedi commento in setup-import.service.ts).
setups.post("/import", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  const carId = typeof body.carId === "string" ? body.carId : "";

  if (!file || typeof file === "string") {
    return c.json(
      { error: "file is required (multipart form field 'file')" },
      400
    );
  }

  if (!carId) {
    return c.json({ error: "carId is required" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSvmFile(buffer);

  return c.json({
    fileName: file.name,
    keyValues: parsed.keyValues,
    suggestions: parsed.suggestions,
  });
});

// Ultime modifiche proposte dal coach, rilette dallo storico messaggi.
// Registrata PRIMA di "/:id", altrimenti Hono interpreta "suggestions"
// come un id di setup.
setups.get("/suggestions", async (c) => {
  const message = await getLatestSetupChanges();

  if (!message?.setupChanges) {
    return c.json({ changes: [], createdAt: null });
  }

  try {
    return c.json({
      changes: JSON.parse(message.setupChanges),
      createdAt: message.createdAt,
    });
  } catch {
    return c.json({ changes: [], createdAt: null });
  }
});

setups.get("/", async (c) => {
  const carId = c.req.query("carId");

  if (!carId) {
    return c.json({ error: "carId is required" }, 400);
  }

  const items = await getSetupsByCar(carId);
  return c.json({ items });
});

setups.get("/:id", async (c) => {
  const id = c.req.param("id");
  const setup = await getSetupById(id);

  if (!setup) {
    return c.json({ error: "Setup not found" }, 404);
  }

  return c.json({ setup });
});

setups.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.carId || !body.name) {
    return c.json({ error: "carId and name are required" }, 400);
  }

  const id = randomUUID();

  await createSetup({
    id,
    carId: body.carId,
    name: body.name,
    brakeBias: body.brakeBias ?? null,
    frontRideHeight: body.frontRideHeight ?? null,
    rearRideHeight: body.rearRideHeight ?? null,
    frontCamber: body.frontCamber ?? null,
    rearCamber: body.rearCamber ?? null,
    frontToe: body.frontToe ?? null,
    rearToe: body.rearToe ?? null,
    frontARB: body.frontARB ?? null,
    rearARB: body.rearARB ?? null,
    frontSpring: body.frontSpring ?? null,
    rearSpring: body.rearSpring ?? null,
    diffPreload: body.diffPreload ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ id });
});

setups.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

  await updateSetup(id, {
    name: body.name,
    brakeBias: body.brakeBias ?? null,
    frontRideHeight: body.frontRideHeight ?? null,
    rearRideHeight: body.rearRideHeight ?? null,
    frontCamber: body.frontCamber ?? null,
    rearCamber: body.rearCamber ?? null,
    frontToe: body.frontToe ?? null,
    rearToe: body.rearToe ?? null,
    frontARB: body.frontARB ?? null,
    rearARB: body.rearARB ?? null,
    frontSpring: body.frontSpring ?? null,
    rearSpring: body.rearSpring ?? null,
    diffPreload: body.diffPreload ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ ok: true });
});

// Imposta questo setup come attivo per la sua auto: e' quello che il
// coach usa come base per proporre modifiche.
setups.patch("/:id/activate", async (c) => {
  const id = c.req.param("id");

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

  await activateSetup(id);

  return c.json({ ok: true });
});

setups.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

  await deleteSetup(id);

  return c.json({ ok: true });
});

export default setups;
