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

  await updateTrack(id, {
    name: body.name,
    country: body.country ?? null,
  });

  return c.json({ ok: true });
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
