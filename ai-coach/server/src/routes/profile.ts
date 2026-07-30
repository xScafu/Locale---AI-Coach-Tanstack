import { Hono } from "hono";
import { randomUUID } from "node:crypto";

import {
  activatePilot,
  createPilot,
  getActivePilot,
  getAllPilots,
  getPilot,
  updatePilot,
} from "../repositories/profile.repository";

const profile = new Hono();

profile.get("/current", async (c) => {
  const pilot = await getActivePilot();

  if (!pilot) {
    return c.json(
      {
        message: "Nessun pilota attivo",
      },
      404
    );
  }

  return c.json(pilot);
});

// Nuovo: elenco di tutti i piloti, per le card selezionabili in UI.
profile.get("/", async (c) => {
  const items = await getAllPilots();
  return c.json({ items });
});

profile.post("/", async (c) => {
  const body = await c.req.json();

  const id = randomUUID();

  await createPilot({
    id,

    name: body.name,

    level: body.level,

    experience: body.experience,

    drivingStyle: body.drivingStyle,
  });

  return c.json({
    id,
  });
});

// Nuovo: modifica di un pilota esistente.
profile.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getPilot(id);
  if (!existing) {
    return c.json({ error: "Pilot not found" }, 404);
  }

  await updatePilot(id, {
    name: body.name,
    level: body.level,
    experience: body.experience,
    drivingStyle: body.drivingStyle,
  });

  return c.json({ ok: true });
});

// Nuovo: imposta un pilota come attivo (stesso pattern già usato per
// auto e circuiti).
profile.patch("/:id/activate", async (c) => {
  const id = c.req.param("id");

  const existing = await getPilot(id);
  if (!existing) {
    return c.json({ error: "Pilot not found" }, 404);
  }

  await activatePilot(id);

  return c.json({ ok: true });
});

export default profile;
