import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
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
  releaseDuckDbFile,
  runReadOnlyQuery,
} from "../services/telemetry.service";

import { linkImportToTrack } from "../services/track-profile.service";

const telemetry = new Hono();
const STORAGE_DIR = path.resolve("./data/telemetry");

telemetry.get("/", async (c) => {
  const carId = c.req.query("carId");
  const items = await getTelemetryImports(carId);
  return c.json({ items });
});

// I file .duckdb rimasti su disco senza una riga corrispondente in
// telemetry_imports. Prima che l'eliminazione rimuovesse anche il file
// se ne accumulavano centinaia di MB.
//
// Registrata PRIMA di "/:id": Hono risolve nell'ordine di
// registrazione, quindi con l'ordine invertito "orphans" verrebbe letto
// come un id.
async function findOrphanFiles() {
  await mkdir(STORAGE_DIR, { recursive: true });

  const imports = await getTelemetryImports();
  const known = new Set(
    imports.map((i) => path.resolve(i.filePath).toLowerCase())
  );

  const entries = await readdir(STORAGE_DIR);
  const orphans: { file: string; fullPath: string; bytes: number }[] = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".duckdb")) continue;

    const fullPath = path.join(STORAGE_DIR, entry);
    if (known.has(path.resolve(fullPath).toLowerCase())) continue;

    const info = await stat(fullPath);
    orphans.push({ file: entry, fullPath, bytes: info.size });
  }

  return orphans;
}

telemetry.get("/orphans", async (c) => {
  const orphans = await findOrphanFiles();

  return c.json({
    items: orphans.map(({ file, bytes }) => ({ file, bytes })),
    totalBytes: orphans.reduce((sum, o) => sum + o.bytes, 0),
  });
});

telemetry.delete("/orphans", async (c) => {
  const orphans = await findOrphanFiles();

  let deleted = 0;
  let freedBytes = 0;
  const failed: string[] = [];

  for (const orphan of orphans) {
    try {
      await releaseDuckDbFile(orphan.fullPath);
      await rm(orphan.fullPath, { force: true });
      deleted++;
      freedBytes += orphan.bytes;
    } catch {
      failed.push(orphan.file);
    }
  }

  return c.json({ deleted, freedBytes, failed });
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

    // Collega l'import al circuito dichiarato nel file e rigenera il
    // profilo del tracciato. Non puo' far fallire l'import: se non
    // riesce, restituisce semplicemente trackId null.
    const link = await linkImportToTrack(id, filePath, carId);

    return c.json({
      id,
      status: "parsed",
      tables,
      trackId: link.trackId,
      trackName: link.trackName,
      trackCreated: link.created,
      cornersDetected: link.profile?.corners.length ?? null,
    });
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

  // Prima veniva cancellata solo la riga: il file .duckdb restava su
  // disco per sempre, scollegato da tutto. Il rilascio della
  // connessione deve precedere l'unlink, altrimenti su Windows il file
  // risulta ancora aperto dalla cache di openDb e la cancellazione
  // fallisce.
  let fileRemoved = true;

  try {
    await releaseDuckDbFile(item.filePath);
    await rm(item.filePath, { force: true });
  } catch (error) {
    // L'import e' comunque sparito dal DB: il file rimasto indietro
    // verra' recuperato da DELETE /api/telemetry/orphans.
    console.error("[telemetry] file non rimosso:", item.filePath, error);
    fileRemoved = false;
  }

  return c.json({ ok: true, fileRemoved });
});

export default telemetry;
