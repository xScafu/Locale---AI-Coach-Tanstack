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

export async function createCar(data: NewCar) {
  return await db.insert(cars).values(data);
}

export async function getCars() {
  return await db.select().from(cars).orderBy(desc(cars.createdAt));
}

export async function getCar(id: string) {
  const result = await db.select().from(cars).where(eq(cars.id, id));

  return result[0] ?? null;
}

export async function getCarsByPilot(pilotId: string) {
  return db.select().from(cars).where(eq(cars.pilotId, pilotId));
}

export async function getCarById(id: string) {
  const result = await db.select().from(cars).where(eq(cars.id, id));
  return result[0] ?? null;
}

export async function updateCar(id: string, data: Partial<NewCar>) {
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
