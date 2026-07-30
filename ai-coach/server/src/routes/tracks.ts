import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  activateTrack,
  createTrack,
  deleteTrack,
  getTrackById,
  getTracksByPilot,
  updateTrack,
  updateTrackLayout,
} from "../repositories/track.repository";

import { regenerateTrackProfile } from "../services/track-profile.service";

const tracks = new Hono();

tracks.get("/", async (c) => {
  const pilotId = c.req.query("pilotId");

  if (!pilotId) {
    return c.json({ error: "pilotId is required" }, 400);
  }

  const items = await getTracksByPilot(pilotId);
  return c.json({ items });
});

tracks.get("/:id", async (c) => {
  const id = c.req.param("id");
  const track = await getTrackById(id);

  if (!track) {
    return c.json({ error: "Track not found" }, 404);
  }

  return c.json({ track });
});

tracks.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.pilotId || !body.name) {
    return c.json({ error: "pilotId and name are required" }, 400);
  }

  const id = randomUUID();

  await createTrack({
    id,
    pilotId: body.pilotId,
    name: body.name,
    country: body.country ?? null,
  });

  return c.json({ id });
});

tracks.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getTrackById(id);
  if (!existing) {
    return c.json({ error: "Track not found" }, 404);
  }

  // I campi numerici della scheda sono opzionali: stringa vuota o
  // valore non numerico vanno letti come "non compilato", non come 0.
  const num = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  await updateTrack(id, {
    name: body.name,
    country: body.country ?? null,
    variant: body.variant ?? null,
    lengthM: num(body.lengthM),
    cornerCount: num(body.cornerCount),
    referenceLapSeconds: num(body.referenceLapSeconds),
    notes: body.notes ?? null,
  });

  return c.json({ ok: true });
});

// Rigenera il profilo del tracciato dall'import di telemetria piu'
// recente collegato a questo circuito. Serve per i circuiti creati
// prima che il collegamento automatico esistesse, e per rigenerare il
// profilo dopo aver caricato un giro migliore.
tracks.post("/:id/profile", async (c) => {
  const id = c.req.param("id");

  const existing = await getTrackById(id);
  if (!existing) {
    return c.json({ error: "Track not found" }, 404);
  }

  const result = await regenerateTrackProfile(id);

  if (!result) {
    return c.json(
      {
        error:
          "Nessun import di telemetria utilizzabile per questo circuito. Carica un file .duckdb dalla pagina Telemetria.",
      },
      400
    );
  }

  return c.json({ profile: result });
});

tracks.put("/:id/layout", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getTrackById(id);
  if (!existing) {
    return c.json({ error: "Track not found" }, 404);
  }

  if (!Array.isArray(body.points)) {
    return c.json({ error: "points (array) is required" }, 400);
  }

  await updateTrackLayout(id, JSON.stringify(body.points));

  return c.json({ ok: true });
});

tracks.patch("/:id/activate", async (c) => {
  const id = c.req.param("id");

  const existing = await getTrackById(id);
  if (!existing) {
    return c.json({ error: "Track not found" }, 404);
  }

  await activateTrack(id);

  return c.json({ ok: true });
});

tracks.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await getTrackById(id);
  if (!existing) {
    return c.json({ error: "Track not found" }, 404);
  }

  await deleteTrack(id);

  return c.json({ ok: true });
});

export default tracks;
