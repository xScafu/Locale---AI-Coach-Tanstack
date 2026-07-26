import { eq } from "drizzle-orm";
import { db } from "../db";
import { cars } from "../db/schema";

export type CarInsert = {
  id: string;
  pilotId: string;
  manufacturer?: string | null;
  name: string;
  simulator?: string | null;
  category?: string | null;
  notes?: string | null;
};

export type CarUpdate = Partial<Omit<CarInsert, "id" | "pilotId">>;

export async function createCar(data: CarInsert) {
  await db.insert(cars).values(data);
  return data;
}

export async function getCarsByPilot(pilotId: string) {
  return db.select().from(cars).where(eq(cars.pilotId, pilotId));
}

export async function getCarById(id: string) {
  const result = await db.select().from(cars).where(eq(cars.id, id));
  return result[0] ?? null;
}

export async function updateCar(id: string, data: CarUpdate) {
  await db.update(cars).set(data).where(eq(cars.id, id));
}

export async function deleteCar(id: string) {
  await db.delete(cars).where(eq(cars.id, id));
}

export async function getActiveCar() {
  const result = await db
    .select()
    .from(cars)
    .where(eq(cars.isActive, true))
    .limit(1);

  return result[0] ?? null;
}

// Prima non esisteva alcuna deattivazione: più auto potevano risultare
// "isActive = true" contemporaneamente e getActiveCar() tornava un
// risultato arbitrario. Ora si comporta come profile.repository.ts.
export async function deactivateCars() {
  await db.update(cars).set({ isActive: false });
}

export async function activateCar(id: string) {
  await deactivateCars();

  await db.update(cars).set({ isActive: true }).where(eq(cars.id, id));
}
