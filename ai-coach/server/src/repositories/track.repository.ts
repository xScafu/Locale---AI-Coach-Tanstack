import { eq } from "drizzle-orm";
import { db } from "../db";
import { tracks } from "../db/schema";

export type TrackInsert = {
  id: string;
  pilotId: string;
  name: string;
  country?: string | null;
};

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
