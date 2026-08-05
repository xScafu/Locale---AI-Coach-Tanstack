import { getActivePilot } from "../repositories/profile.repository";
import { getActiveCar } from "../repositories/car.repository";
import { getActiveTrack } from "../repositories/track.repository";
import { getSettings } from "../repositories/settings.repository";
import { getActiveSetupByCar } from "../repositories/setup.repository";
import { getSessionMemory } from "./memory.service";
import { searchKnowledgeEntries } from "../repositories/knowledge.repository";
import { getTelemetryImports } from "../repositories/telemetry.repository";
import {
  getTelemetryDigest,
  type TelemetryDigest,
} from "./telemetry-digest.service";
import {
  compareLaps,
  cornersForImport,
  findReferenceFor,
  type LapComparison,
} from "./telemetry-compare.service";

// L'import più recente già analizzato dell'auto attiva: è la sessione di
// cui il coach parla. I riferimenti non compaiono qui perché non hanno
// carId — appartengono a un circuito, non a un'auto del garage.
async function latestImportForCar(carId: string | undefined) {
  if (!carId) return null;

  const imports = await getTelemetryImports(carId);
  return imports.find((i) => i.status === "parsed" && !i.isReference) ?? null;
}

// Il digest — una riga per giro più il giro migliore aperto per famiglia
// — che arricchisce il contesto del coach. Eventuali errori (file
// mancante/corrotto) non devono mai bloccare la chat: in caso di
// problemi, telemetry resta null.
async function loadTelemetrySummary(
  item: { filePath: string } | null
): Promise<TelemetryDigest | null> {
  if (!item) return null;

  try {
    return await getTelemetryDigest(item.filePath);
  } catch {
    return null;
  }
}

// Il confronto con il giro di riferimento del circuito, se ce n'è uno.
// Come il digest, non può far fallire la chat: senza riferimento, o con
// un riferimento di un'altra pista, resta semplicemente null.
async function loadComparison(
  item: {
    id: string;
    filePath: string;
    trackId: string | null;
    metadata: string | null;
  } | null
): Promise<LapComparison | null> {
  if (!item) return null;

  try {
    const reference = await findReferenceFor(item);
    if (!reference || reference.id === item.id) return null;

    return await compareLaps(item.filePath, reference.filePath, {
      corners: await cornersForImport(item),
      importId: item.id,
      referenceImportId: reference.id,
    });
  } catch (error) {
    // Il confronto non deve far fallire la chat, ma restare in silenzio
    // lo rende indistinguibile da "non c'e' un riferimento": il prompt
    // dice al pilota di caricarne uno che ha gia' caricato.
    console.error("[app-context] confronto non riuscito:", error);
    return null;
  }
}

export async function loadAppContext(sessionId?: string, message?: string) {
  const [pilot, car, track, settings, coachMemory, knowledge] =
    await Promise.all([
      getActivePilot(),

      getActiveCar(),

      getActiveTrack(),

      getSettings(),

      sessionId ? getSessionMemory(sessionId) : Promise.resolve(""),

      message ? searchKnowledgeEntries(message, 5) : Promise.resolve([]),
    ]);

  // Digest e confronto leggono lo stesso import: cercarlo una volta sola
  // evita anche che i due possano parlare di sessioni diverse.
  const latestImport = await latestImportForCar(car?.id);

  const [telemetry, comparison] = await Promise.all([
    loadTelemetrySummary(latestImport),
    loadComparison(latestImport),
  ]);

  // Il setup attivo dell'auto attiva: e' la base su cui il coach
  // propone modifiche. Se manca, il coach deve chiederne il
  // caricamento invece di inventare valori di partenza.
  const setup = car?.id ? await getActiveSetupByCar(car.id) : null;

  return {
    pilot,

    car,

    track,

    settings,

    coachMemory,

    knowledge,

    telemetry,

    comparison,

    setup,
  };
}
