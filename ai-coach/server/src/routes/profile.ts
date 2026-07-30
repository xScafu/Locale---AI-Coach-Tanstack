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

// Il pilota attivo secondo il server: e' l'unica fonte di verita', il
// client non lo tiene piu' in localStorage.
//
// Restituisce 200 con pilot: null quando non ce n'e' nessuno. Prima
// rispondeva 404, ma "non hai ancora creato un pilota" e' uno stato
// normale dell'app, non un errore: con il 404 ogni pagina avrebbe
// dovuto distinguere un errore di rete da un database vuoto.
profile.get("/current", async (c) => {
  const pilot = await getActivePilot();

  return c.json({ pilot: pilot ?? null });
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
