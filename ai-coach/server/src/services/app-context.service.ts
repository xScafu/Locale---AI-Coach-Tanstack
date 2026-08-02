import { getActivePilot } from "../repositories/profile.repository";
import { getActiveCar } from "../repositories/car.repository";
import { getActiveTrack } from "../repositories/track.repository";
import { getSettings } from "../repositories/settings.repository";
import { getActiveSetupByCar } from "../repositories/setup.repository";
import { getSessionMemory } from "./memory.service";
import { searchKnowledgeEntries } from "../repositories/knowledge.repository";
import { getTelemetryImports } from "../repositories/telemetry.repository";
import {
  getTelemetrySummary,
  type TelemetrySummary,
} from "./telemetry.service";

// Se l'auto attiva ha un import di telemetria già analizzato, recupera
// il riassunto sintetico del giro migliore per arricchire il contesto
// del coach. Eventuali errori (file mancante/corrotto) non devono mai
// bloccare la chat: in caso di problemi, telemetry resta null.
async function loadTelemetrySummary(
  carId: string | undefined
): Promise<TelemetrySummary | null> {
  if (!carId) return null;

  try {
    const imports = await getTelemetryImports(carId);
    const latestParsed = imports.find((i) => i.status === "parsed");

    if (!latestParsed) return null;

    return await getTelemetrySummary(latestParsed.filePath);
  } catch {
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

  const telemetry = await loadTelemetrySummary(car?.id);

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

    setup,
  };
}
