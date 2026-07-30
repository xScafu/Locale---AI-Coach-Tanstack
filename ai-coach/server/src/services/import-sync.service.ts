import { randomUUID } from "node:crypto";

import { computeTrackProfile, getMetadata } from "./telemetry.service";
import { namesMatch, normalize } from "./track-profile.service";
import {
  activatePilot,
  createPilot,
  getAllPilots,
} from "../repositories/profile.repository";
import {
  activateCar,
  createCar,
  getCarsByPilot,
} from "../repositories/car.repository";
import {
  activateTrack,
  createTrack,
  getTrackById,
  getTracksByPilot,
  saveTrackProfile,
} from "../repositories/track.repository";
import { updateTelemetryImport } from "../repositories/telemetry.repository";

// Cosa e' successo a un'entita' durante la sincronizzazione. Serve a
// dire all'utente perche' l'app e' cambiata sotto i suoi occhi: un
// import che riconfigura pilota, auto e circuito senza spiegarsi
// sembrerebbe un bug.
export type SyncAction = "created" | "matched";

export type SyncEntity = {
  id: string;
  name: string;
  action: SyncAction;
  activated: boolean;
};

export type ImportSyncResult = {
  pilot: SyncEntity | null;
  car: SyncEntity | null;
  track: SyncEntity | null;
  session: {
    type: string | null;
    weather: string | null;
    recordedAt: number | null;
  };
  profile: {
    corners: number;
    lengthM: number;
    bestLapSeconds: number;
    theoreticalLapSeconds: number | null;
  } | null;
};

// "2026-07-22T20_39_01Z": LMU usa gli underscore al posto dei due punti
// perche' il valore finisce anche nel nome del file.
function parseRecordingTime(value: string | undefined): number | null {
  if (!value) return null;

  const iso = value.replace(
    /T(\d{2})_(\d{2})_(\d{2})/,
    (_m, h, m, s) => `T${h}:${m}:${s}`
  );

  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

// "BMW M Team WRT 2026 #15:WEC" -> marca "BMW", nome senza il prefisso
// gia' finito nella marca, altrimenti in interfaccia si legge due volte.
function splitCarName(carName: string) {
  const manufacturer = carName.trim().split(/\s+/)[0] ?? carName;

  const rest = carName.trim().slice(manufacturer.length).trim();

  return { manufacturer, name: rest || carName };
}

async function syncPilot(driverName: string): Promise<SyncEntity> {
  const pilots = await getAllPilots();

  const existing =
    pilots.find((p) => normalize(p.name) === normalize(driverName)) ??
    pilots.find((p) => namesMatch(p.name, driverName)) ??
    null;

  if (existing) {
    await activatePilot(existing.id);
    return {
      id: existing.id,
      name: existing.name,
      action: "matched",
      activated: true,
    };
  }

  const id = randomUUID();

  // createPilot disattiva gia' gli altri e rende attivo il nuovo.
  await createPilot({ id, name: driverName });

  return { id, name: driverName, action: "created", activated: true };
}

async function syncCar(
  pilotId: string,
  carName: string,
  carClass: string | null
): Promise<SyncEntity> {
  const cars = await getCarsByPilot(pilotId);

  const existing =
    cars.find((c) => normalize(c.name) === normalize(carName)) ??
    cars.find((c) => namesMatch(`${c.manufacturer ?? ""} ${c.name}`, carName)) ??
    null;

  if (existing) {
    await activateCar(existing.id);
    return {
      id: existing.id,
      name: [existing.manufacturer, existing.name].filter(Boolean).join(" "),
      action: "matched",
      activated: true,
    };
  }

  const id = randomUUID();
  const { manufacturer, name } = splitCarName(carName);

  await createCar({
    id,
    pilotId,
    manufacturer,
    name,
    simulator: "Le Mans Ultimate",
    category: carClass,
    notes: null,
  });

  await activateCar(id);

  return { id, name: carName, action: "created", activated: true };
}

async function syncTrack(
  pilotId: string,
  trackName: string,
  variant: string | null
): Promise<SyncEntity> {
  const tracks = await getTracksByPilot(pilotId);

  const existing =
    tracks.find((t) => normalize(t.name) === normalize(trackName)) ??
    tracks.find((t) => namesMatch(t.name, trackName)) ??
    null;

  if (existing) {
    await activateTrack(existing.id);
    return {
      id: existing.id,
      name: existing.name,
      action: "matched",
      activated: true,
    };
  }

  const id = randomUUID();

  await createTrack({ id, pilotId, name: trackName, country: null, variant });
  await activateTrack(id);

  return { id, name: trackName, action: "created", activated: true };
}

// Legge i metadata del file appena caricato e allinea l'app a quella
// sessione: pilota, auto e circuito vengono riconosciuti o creati, resi
// attivi e collegati all'import, e il profilo del tracciato viene
// rigenerato.
//
// Non lancia mai: un file valido non deve risultare "in errore" solo
// perche' un metadato manca. Cio' che non si e' potuto dedurre torna
// semplicemente null nel risultato.
export async function syncImportFromMetadata(
  importId: string,
  filePath: string
): Promise<ImportSyncResult> {
  const empty: ImportSyncResult = {
    pilot: null,
    car: null,
    track: null,
    session: { type: null, weather: null, recordedAt: null },
    profile: null,
  };

  try {
    const metadata = await getMetadata(filePath);

    const recordedAt = parseRecordingTime(metadata["RecordingTime"]);

    const session = {
      type: metadata["SessionType"]?.trim() || null,
      weather: metadata["WeatherConditions"]?.trim() || null,
      recordedAt,
    };

    const driverName = metadata["DriverName"]?.trim();
    const carName = metadata["CarName"]?.trim();
    const trackName = metadata["TrackName"]?.trim();
    const variant = metadata["TrackLayout"]?.trim() || null;

    // Senza pilota non si puo' creare nulla: sia cars che tracks hanno
    // pilot_id NOT NULL.
    const pilot = driverName ? await syncPilot(driverName) : null;

    const car =
      pilot && carName
        ? await syncCar(pilot.id, carName, metadata["CarClass"]?.trim() || null)
        : null;

    const track =
      pilot && trackName
        ? await syncTrack(pilot.id, trackName, variant)
        : null;

    await updateTelemetryImport(importId, {
      pilotId: pilot?.id ?? null,
      carId: car?.id ?? null,
      trackId: track?.id ?? null,
      metadata: JSON.stringify(metadata),
      recordedAt,
    });

    let profile: ImportSyncResult["profile"] = null;

    if (track) {
      const computed = await computeTrackProfile(filePath);

      if (computed) {
        await saveTrackProfile(track.id, JSON.stringify(computed), importId, {
          lengthM: computed.lengthM,
          cornerCount: computed.corners.length,
        });

        profile = {
          corners: computed.corners.length,
          lengthM: computed.lengthM,
          bestLapSeconds: computed.bestLapSeconds,
          theoreticalLapSeconds:
            computed.reference?.theoreticalLapSeconds ?? null,
        };
      }
    }

    return { pilot, car, track, session, profile };
  } catch (error) {
    console.error("[import-sync] sincronizzazione fallita:", error);
    return empty;
  }
}
