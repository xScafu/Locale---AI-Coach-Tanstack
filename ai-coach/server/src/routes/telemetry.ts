import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import {
  createTelemetryImport,
  deleteTelemetryImport,
  getTelemetryImportById,
  getTelemetryImports,
  updateTelemetryImport,
} from "../repositories/telemetry.repository";

import {
  getChannelsList,
  getLaps,
  getLapTelemetrySeries,
  getMetadata,
  inspectDuckDbFile,
  runReadOnlyQuery,
} from "../services/telemetry.service";

const telemetry = new Hono();
const STORAGE_DIR = path.resolve("./data/telemetry");

telemetry.get("/", async (c) => {
  const carId = c.req.query("carId");
  const items = await getTelemetryImports(carId);
  return c.json({ items });
});

telemetry.get("/:id", async (c) => {
  const id = c.req.param("id");
  const item = await getTelemetryImportById(id);

  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  return c.json({ item });
});

telemetry.post("/import", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  const carId =
    typeof body.carId === "string" && body.carId ? body.carId : null;

  if (!file || typeof file === "string") {
    return c.json(
      { error: "file is required (multipart form field 'file')" },
      400
    );
  }

  if (!file.name.toLowerCase().endsWith(".duckdb")) {
    return c.json({ error: "Il file deve avere estensione .duckdb" }, 400);
  }

  await mkdir(STORAGE_DIR, { recursive: true });

  const id = randomUUID();
  const filePath = path.join(STORAGE_DIR, `${id}.duckdb`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  await createTelemetryImport({
    id,
    carId,
    fileName: file.name,
    filePath,
    tables: null,
    status: "pending",
    errorMessage: null,
  });

  try {
    const tables = await inspectDuckDbFile(filePath);

    await updateTelemetryImport(id, {
      tables: JSON.stringify(tables),
      status: "parsed",
    });

    return c.json({ id, status: "parsed", tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";

    await updateTelemetryImport(id, {
      status: "error",
      errorMessage: message,
    });

    return c.json({ id, status: "error", error: message }, 500);
  }
});

// Esplorazione: esegue una SELECT sul file .duckdb importato, per capire
// come sono strutturati davvero i dati di LMU prima di scrivere il
// mapping definitivo verso le tabelle dell'app.
telemetry.post("/:id/query", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";

  if (!sql) {
    return c.json({ error: "sql is required" }, 400);
  }

  if (!/^select\s/i.test(sql)) {
    return c.json({ error: "Sono permesse solo query SELECT" }, 400);
  }

  const item = await getTelemetryImportById(id);
  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  try {
    const rows = await runReadOnlyQuery(item.filePath, sql);
    return c.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return c.json({ error: message }, 400);
  }
});

telemetry.get("/:id/metadata", async (c) => {
  const id = c.req.param("id");
  const item = await getTelemetryImportById(id);

  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  try {
    const metadata = await getMetadata(item.filePath);
    return c.json({ metadata });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return c.json({ error: message }, 500);
  }
});

telemetry.get("/:id/laps", async (c) => {
  const id = c.req.param("id");
  const item = await getTelemetryImportById(id);

  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  try {
    const laps = await getLaps(item.filePath);
    return c.json({ laps });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return c.json({ error: message }, 500);
  }
});

telemetry.get("/:id/laps/:lapNumber", async (c) => {
  const id = c.req.param("id");
  const lapNumber = Number(c.req.param("lapNumber"));

  if (Number.isNaN(lapNumber)) {
    return c.json({ error: "lapNumber non valido" }, 400);
  }

  const item = await getTelemetryImportById(id);
  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  try {
    const points = await getLapTelemetrySeries(item.filePath, lapNumber);
    return c.json({ points });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return c.json({ error: message }, 500);
  }
});

telemetry.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const item = await getTelemetryImportById(id);
  if (!item) {
    return c.json({ error: "Import not found" }, 404);
  }

  await deleteTelemetryImport(id);

  return c.json({ ok: true });
});

export default telemetry;
