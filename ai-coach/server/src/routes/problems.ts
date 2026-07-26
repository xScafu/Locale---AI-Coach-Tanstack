import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  createProblem,
  deleteProblem,
  getProblemById,
  getProblemsByCar,
  updateProblem,
} from "../repositories/problem.repository";

const problems = new Hono();

problems.get("/", async (c) => {
  const carId = c.req.query("carId");

  if (!carId) {
    return c.json({ error: "carId is required" }, 400);
  }

  const items = await getProblemsByCar(carId);
  return c.json({ items });
});

problems.get("/:id", async (c) => {
  const id = c.req.param("id");
  const problem = await getProblemById(id);

  if (!problem) {
    return c.json({ error: "Problem not found" }, 404);
  }

  return c.json({ problem });
});

problems.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.carId || !body.phase || !body.problem) {
    return c.json({ error: "carId, phase and problem are required" }, 400);
  }

  const id = randomUUID();

  await createProblem({
    id,
    carId: body.carId,
    phase: body.phase,
    problem: body.problem,
    severity: body.severity ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ id });
});

problems.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  await updateProblem(id, {
    phase: body.phase,
    problem: body.problem,
    severity: body.severity ?? null,
    notes: body.notes ?? null,
  });

  return c.json({ ok: true });
});

problems.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await deleteProblem(id);

  return c.json({ ok: true });
});

export default problems;
