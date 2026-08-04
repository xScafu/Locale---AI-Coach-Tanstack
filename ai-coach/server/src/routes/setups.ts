import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  activateSetup,
  createSetup,
  deleteSetup,
  getSetupById,
  getSetupsByCar,
  updateSetup,
} from "../repositories/setup.repository";

import { parseSvmFile } from "../services/setup-import.service";
import { getLatestSetupChanges } from "../repositories/message.repository";

const setups = new Hono();

// "Base Monza" -> "Base Monza v2" -> "Base Monza v3". Il nome resta
// riconoscibile mentre le versioni si accumulano.
function nextVersionName(name: string) {
  const match = name.match(/^(.*?)\s+v(\d+)$/);

  if (match) return `${match[1]} v${Number(match[2]) + 1}`;

  return `${name} v2`;
}

// Restituisce solo un'anteprima parsata: non salva nulla finché
// l'utente non conferma dalla UI (i valori sono "suggerimenti", non
// certezze - vedi commento in setup-import.service.ts).
setups.post("/import", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  const carId = typeof body.carId === "string" ? body.carId : "";

  if (!file || typeof file === "string") {
    return c.json(
      { error: "file is required (multipart form field 'file')" },
      400
    );
  }

  if (!carId) {
    return c.json({ error: "carId is required" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSvmFile(buffer);

  return c.json({
    fileName: file.name,
    keyValues: parsed.keyValues,
    suggestions: parsed.suggestions,
    // Il contenuto integrale torna al client, che lo rimanda a
    // POST /api/setups alla creazione: e' l'unico modo per poter poi
    // riesportare un .svm completo, visto che la tabella conserva solo
    // dodici valori.
    raw: parsed.raw,
  });
});

// Ultime modifiche proposte dal coach, rilette dallo storico messaggi.
// Registrata PRIMA di "/:id", altrimenti Hono interpreta "suggestions"
// come un id di setup.
setups.get("/suggestions", async (c) => {
  const message = await getLatestSetupChanges();

  if (!message?.setupChanges) {
    return c.json({ changes: [], createdAt: null });
  }

  try {
    return c.json({
      changes: JSON.parse(message.setupChanges),
      createdAt: message.createdAt,
    });
  } catch {
    return c.json({ changes: [], createdAt: null });
  }
});

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
    sourceSvm: body.sourceSvm ?? null,
    sourceFileName: body.sourceFileName ?? null,
    derivedFromId: body.derivedFromId ?? null,
  });

  return c.json({ id });
});

// Crea una NUOVA versione applicando le modifiche indicate, invece di
// sovrascrivere il setup di partenza: cosi' il punto di partenza resta
// consultabile e ci si puo' tornare. Il .svm originale viene ereditato,
// altrimenti la versione derivata non sarebbe piu' esportabile.
setups.post("/:id/apply", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const base = await getSetupById(id);
  if (!base) {
    return c.json({ error: "Setup not found" }, 404);
  }

  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length === 0) {
    return c.json({ error: "changes (array) is required" }, 400);
  }

  const applied: Record<string, number> = {};
  for (const change of changes) {
    if (
      typeof change?.field === "string" &&
      typeof change?.suggestedValue === "number"
    ) {
      applied[change.field] = change.suggestedValue;
    }
  }

  const newId = randomUUID();

  await createSetup({
    id: newId,
    carId: base.carId,
    name: typeof body.name === "string" && body.name ? body.name : nextVersionName(base.name),
    brakeBias: applied.brakeBias ?? base.brakeBias,
    frontRideHeight: applied.frontRideHeight ?? base.frontRideHeight,
    rearRideHeight: applied.rearRideHeight ?? base.rearRideHeight,
    frontCamber: applied.frontCamber ?? base.frontCamber,
    rearCamber: applied.rearCamber ?? base.rearCamber,
    frontToe: applied.frontToe ?? base.frontToe,
    rearToe: applied.rearToe ?? base.rearToe,
    frontARB: applied.frontARB ?? base.frontARB,
    rearARB: applied.rearARB ?? base.rearARB,
    frontSpring: applied.frontSpring ?? base.frontSpring,
    rearSpring: applied.rearSpring ?? base.rearSpring,
    diffPreload: applied.diffPreload ?? base.diffPreload,
    notes: base.notes,
    sourceSvm: base.sourceSvm,
    sourceFileName: base.sourceFileName,
    derivedFromId: base.id,
  });

  return c.json({ id: newId, appliedFields: Object.keys(applied) });
});

setups.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

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

// Imposta questo setup come attivo per la sua auto: e' quello che il
// coach usa come base per proporre modifiche.
setups.patch("/:id/activate", async (c) => {
  const id = c.req.param("id");

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

  await activateSetup(id);

  return c.json({ ok: true });
});

// Scarica il .svm da caricare nel simulatore.
//
// Restituisce il file di partenza cosi' com'e'. NON riscrive i valori
// modificati: in un .svm il valore che LMU legge e' un indice
// ("CamberSetting=14"), mentre il numero leggibile sta nel commento
// ("//-3.4 deg"). Senza conoscere il passo della scala non si puo'
// risalire dall'uno all'altro, e un file con i commenti aggiornati ma
// gli indici vecchi verrebbe caricato con i valori vecchi: peggio che
// non esportarlo.
setups.get("/:id/export", async (c) => {
  const id = c.req.param("id");

  const setup = await getSetupById(id);
  if (!setup) {
    return c.json({ error: "Setup not found" }, 404);
  }

  if (!setup.sourceSvm) {
    return c.json(
      {
        error:
          "Questo setup non ha un file .svm di origine: e' stato creato a mano. Solo i setup importati da file possono essere riesportati.",
      },
      400
    );
  }

  const fileName =
    setup.sourceFileName ?? `${setup.name.replace(/[^\w\-. ]+/g, "_")}.svm`;

  return new Response(setup.sourceSvm, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});

setups.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await getSetupById(id);
  if (!existing) {
    return c.json({ error: "Setup not found" }, 404);
  }

  await deleteSetup(id);

  return c.json({ ok: true });
});

export default setups;
