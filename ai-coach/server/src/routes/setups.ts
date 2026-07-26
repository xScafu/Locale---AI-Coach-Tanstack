import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  createSetup,
  deleteSetup,
  getSetupById,
  getSetupsByCar,
  updateSetup,
} from "../repositories/setup.repository";

const setups = new Hono();

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

setups.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await deleteSetup(id);

  return c.json({ ok: true });
});

export default setups;
