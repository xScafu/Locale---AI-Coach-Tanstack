import { randomUUID } from "node:crypto";

import {
  computeTrackProfile,
  getMetadata,
  type TrackProfile,
} from "./telemetry.service";
import {
  createTrack,
  getTrackById,
  getTracksByPilot,
  saveTrackProfile,
} from "../repositories/track.repository";
import { getCarById } from "../repositories/car.repository";
import { getActivePilot } from "../repositories/profile.repository";
import {
  getTelemetryImports,
  updateTelemetryImport,
} from "../repositories/telemetry.repository";

// A quale pilota appartiene un import: l'auto associata lo dice con
// certezza, altrimenti si ripiega sul pilota attivo. Senza pilota non
// si puo' creare un circuito, perche' tracks.pilot_id e' NOT NULL.
async function resolvePilotId(carId: string | null) {
  if (carId) {
    const car = await getCarById(carId);
    if (car) return car.pilotId;
  }

  const pilot = await getActivePilot();
  return pilot?.id ?? null;
}

function normalize(value: string) {
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
function namesMatch(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);

  if (!x || !y) return false;

  return x === y || x.includes(y) || y.includes(x);
}

async function findMatchingTrack(pilotId: string, trackName: string) {
  const candidates = await getTracksByPilot(pilotId);

  return (
    candidates.find((t) => normalize(t.name) === normalize(trackName)) ??
    candidates.find((t) => namesMatch(t.name, trackName)) ??
    null
  );
}

export type LinkResult = {
  trackId: string | null;
  trackName: string | null;
  created: boolean;
  profile: TrackProfile | null;
};

// Collega un import appena caricato al circuito che dichiara nei suoi
// metadata, creandolo se non esiste, e rigenera il profilo del
// tracciato a partire da quel file.
//
// Non lancia mai: un import valido non deve fallire solo perche' il
// profilo non si e' potuto calcolare (file senza G laterale, giri
// troppo corti, circuito non deducibile). In quel caso l'import resta
// utilizzabile e il circuito semplicemente non viene collegato.
export async function linkImportToTrack(
  importId: string,
  filePath: string,
  carId: string | null
): Promise<LinkResult> {
  const empty: LinkResult = {
    trackId: null,
    trackName: null,
    created: false,
    profile: null,
  };

  try {
    const metadata = await getMetadata(filePath);

    const trackName = metadata["TrackName"]?.trim();
    if (!trackName) return empty;

    const pilotId = await resolvePilotId(carId);
    if (!pilotId) return { ...empty, trackName };

    const variant = metadata["TrackLayout"]?.trim() || null;

    let track = await findMatchingTrack(pilotId, trackName);
    let created = false;

    if (!track) {
      const id = randomUUID();

      await createTrack({
        id,
        pilotId,
        name: trackName,
        country: null,
        variant,
      });

      track = await getTrackById(id);
      created = true;
    }

    if (!track) return { ...empty, trackName };

    await updateTelemetryImport(importId, { trackId: track.id });

    const profile = await computeTrackProfile(filePath);

    if (profile) {
      await saveTrackProfile(track.id, JSON.stringify(profile), importId, {
        lengthM: profile.lengthM,
        cornerCount: profile.corners.length,
      });
    }

    return { trackId: track.id, trackName, created, profile };
  } catch (error) {
    console.error("[track-profile] collegamento fallito:", error);
    return empty;
  }
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

      await saveTrackProfile(
        trackId,
        JSON.stringify(profile),
        candidate.id,
        { lengthM: profile.lengthM, cornerCount: profile.corners.length }
      );

      return profile;
    } catch (error) {
      console.error("[track-profile] profilo non calcolabile:", error);
    }
  }

  return null;
}
