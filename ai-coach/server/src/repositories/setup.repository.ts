import { eq } from "drizzle-orm";
import { db } from "../db";
import { setups } from "../db/schema";

export type SetupInsert = {
  id: string;
  carId: string;
  name: string;
  brakeBias?: number | null;
  frontRideHeight?: number | null;
  rearRideHeight?: number | null;
  frontCamber?: number | null;
  rearCamber?: number | null;
  frontToe?: number | null;
  rearToe?: number | null;
  frontARB?: number | null;
  rearARB?: number | null;
  frontSpring?: number | null;
  rearSpring?: number | null;
  diffPreload?: number | null;
  notes?: string | null;
};

export type SetupUpdate = Partial<Omit<SetupInsert, "id" | "carId">>;

export async function createSetup(data: SetupInsert) {
  await db.insert(setups).values(data);
  return data;
}

export async function getSetupsByCar(carId: string) {
  return db.select().from(setups).where(eq(setups.carId, carId));
}

export async function getSetupById(id: string) {
  const result = await db.select().from(setups).where(eq(setups.id, id));
  return result[0] ?? null;
}

export async function updateSetup(id: string, data: SetupUpdate) {
  await db.update(setups).set(data).where(eq(setups.id, id));
}

export async function deleteSetup(id: string) {
  await db.delete(setups).where(eq(setups.id, id));
}
