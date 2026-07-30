import {
  computeTrackProfile,
  getMetadata,
  type TrackProfile,
} from "./telemetry.service";
import {
  getTrackById,
  saveTrackProfile,
} from "../repositories/track.repository";
import {
  getTelemetryImports,
  updateTelemetryImport,
} from "../repositories/telemetry.repository";

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // segni diacritici scomposti da NFD
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Il nome nei metadata e' quello ufficiale del simulatore ("Autodromo
// Nazionale Monza"), mentre il pilota il circuito lo chiama "Monza".
// Un confronto esatto creerebbe un doppione a ogni import, quindi si
// accetta anche il caso in cui un nome sia contenuto nell'altro.
export function namesMatch(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);

  if (!x || !y) return false;

  return x === y || x.includes(y) || y.includes(x);
}

// Rigenera il profilo dall'import piu' recente di questo circuito.
// Considera anche gli import ancora senza trackId — quelli caricati
// prima che il collegamento automatico esistesse — riconoscendoli dal
// nome del circuito nei loro metadata e agganciandoli.
export async function regenerateTrackProfile(
  trackId: string
): Promise<TrackProfile | null> {
  const track = await getTrackById(trackId);
  if (!track) return null;

  const imports = await getTelemetryImports();

  const usable = imports.filter((i) => i.status === "parsed");

  const alreadyLinked = usable.filter((i) => i.trackId === trackId);

  let candidates = alreadyLinked;

  if (candidates.length === 0) {
    const orphans = usable.filter((i) => !i.trackId);
    const matched = [];

    for (const orphan of orphans) {
      try {
        const metadata = await getMetadata(orphan.filePath);
        const name = metadata["TrackName"]?.trim();

        if (name && namesMatch(track.name, name)) {
          await updateTelemetryImport(orphan.id, { trackId });
          matched.push(orphan);
        }
      } catch {
        // File mancante o illeggibile: si ignora e si prova il prossimo.
      }
    }

    candidates = matched;
  }

  // getTelemetryImports ordina gia' dal piu' recente.
  for (const candidate of candidates) {
    try {
      const profile = await computeTrackProfile(candidate.filePath);
      if (!profile) continue;

      await saveTrackProfile(trackId, JSON.stringify(profile), candidate.id, {
        lengthM: profile.lengthM,
        cornerCount: profile.corners.length,
      });

      return profile;
    } catch (error) {
      console.error("[track-profile] profilo non calcolabile:", error);
    }
  }

  return null;
}
