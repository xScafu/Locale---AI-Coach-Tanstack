import { eq } from "drizzle-orm";
import { db } from "../db";
import { tracks } from "../db/schema";

export type TrackInsert = {
  id: string;
  pilotId: string;
  name: string;
  country?: string | null;
  variant?: string | null;
};

export type TrackUpdate = Partial<
  Omit<TrackInsert, "id" | "pilotId"> & {
    lengthM: number | null;
    cornerCount: number | null;
    referenceLapSeconds: number | null;
    notes: string | null;
  }
>;

export async function createTrack(data: TrackInsert) {
  await db.insert(tracks).values(data);
  return data;
}

export async function getTracksByPilot(pilotId: string) {
  return db.select().from(tracks).where(eq(tracks.pilotId, pilotId));
}

export async function getTrackById(id: string) {
  const result = await db.select().from(tracks).where(eq(tracks.id, id));
  return result[0] ?? null;
}

export async function updateTrack(id: string, data: TrackUpdate) {
  await db.update(tracks).set(data).where(eq(tracks.id, id));
}

// Salva la sagoma di riferimento del circuito (punti GPS grezzi di un
// giro pulito, scelto manualmente da UI). Serve da sfondo fisso su cui
// sovrapporre la telemetria dei giri successivi.
export async function updateTrackLayout(id: string, layout: string | null) {
  await db.update(tracks).set({ layout }).where(eq(tracks.id, id));
}

export async function saveTrackProfile(
  id: string,
  profile: string,
  importId: string,
  derived: { lengthM: number; cornerCount: number }
) {
  const existing = await getTrackById(id);

  await db
    .update(tracks)
    .set({
      profile,
      profileImportId: importId,
      profileUpdatedAt: Math.floor(Date.now() / 1000),

      // I campi della scheda si precompilano solo se vuoti: un valore
      // scritto dal pilota non va sovrascritto da un nuovo import.
      lengthM: existing?.lengthM ?? derived.lengthM,
      cornerCount: existing?.cornerCount ?? derived.cornerCount,
    })
    .where(eq(tracks.id, id));
}

export async function getActiveTrack() {
  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .limit(1);

  return result[0] ?? null;
}

export async function deactivateTracks() {
  await db.update(tracks).set({ isActive: false });
}

export async function activateTrack(id: string) {
  await deactivateTracks();
  await db.update(tracks).set({ isActive: true }).where(eq(tracks.id, id));
}

export async function deleteTrack(id: string) {
  await db.delete(tracks).where(eq(tracks.id, id));
}
