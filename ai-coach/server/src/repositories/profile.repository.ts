import { db } from "../db";
import { pilots } from "../db/schema";
import { desc, eq } from "drizzle-orm";

export async function createPilot(data: any) {
  await deactivatePilots();
  return await db.insert(pilots).values(data).returning();
}

export async function getPilot(id: string) {
  const result = await db.select().from(pilots).where(eq(pilots.id, id));

  return result[0];
}

// Usata dalla nuova pagina Profilo per mostrare tutte le card piloti,
// non solo quello attivo.
export async function getAllPilots() {
  return db.select().from(pilots).orderBy(desc(pilots.createdAt));
}

export async function getActivePilot() {
  const result = await db
    .select()
    .from(pilots)
    .where(eq(pilots.isActive, true))
    .limit(1);

  return result[0] ?? null;
}

export type PilotUpdate = Partial<{
  name: string;
  level: string;
  experience: string;
  drivingStyle: string;
}>;

// Prima non esisteva alcun modo di modificare un pilota già creato:
// l'unico form disponibile era di sola creazione.
export async function updatePilot(id: string, data: PilotUpdate) {
  await db.update(pilots).set(data).where(eq(pilots.id, id));
}

export async function deactivatePilots() {
  await db.update(pilots).set({
    isActive: false,
  });
}

export async function activatePilot(id: string) {
  await deactivatePilots();

  await db
    .update(pilots)
    .set({
      isActive: true,
    })
    .where(eq(pilots.id, id));
}
