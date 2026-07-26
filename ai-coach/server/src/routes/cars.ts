import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  createCar,
  deleteCar,
  getCarById,
  getCarsByPilot,
  updateCar,
} from "../repositories/car.repository";

const cars = new Hono();

cars.get("/", async (c) => {
  const pilotId = c.req.query("pilotId");

  if (!pilotId) {
    return c.json({ error: "pilotId is required" }, 400);
  }

  const items = await getCarsByPilot(pilotId);
  return c.json({ items });
});

cars.get("/:id", async (c) => {
  const id = c.req.param("id");
  const car = await getCarById(id);

  if (!car) {
    return c.json({ error: "Car not found" }, 404);
  }

  return c.json({ car });
});

cars.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.pilotId || !body.name) {
    return c.json({ error: "pilotId and name are required" }, 400);
  }

  const id = randomUUID();

  await createCar({
    id,
    pilotId: body.pilotId,
    manufacturer: body.manufacturer ?? null,
    name: body.name,
    simulator: body.simulator ?? null,
    category: body.category ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ id });
});

cars.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  await updateCar(id, {
    manufacturer: body.manufacturer ?? null,
    name: body.name,
    simulator: body.simulator ?? null,
    category: body.category ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ ok: true });
});

cars.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await deleteCar(id);

  return c.json({ ok: true });
});

export default cars;
