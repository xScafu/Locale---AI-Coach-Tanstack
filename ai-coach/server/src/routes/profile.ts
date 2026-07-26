import { Hono } from "hono";
import { randomUUID } from "node:crypto";

import { createPilot } from "../repositories/profile.repository";
import { integer } from "drizzle-orm/gel-core";

import { getActivePilot } from "../repositories/profile.repository";

const profile = new Hono();
const date = new Date();

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

export default profile;
