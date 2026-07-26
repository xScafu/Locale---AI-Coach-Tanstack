import { db } from "../db";
import { pilots } from "../db/schema";
import { and, eq } from "drizzle-orm";

export async function createPilot(data: any) {
  await deactivatePilots();
  return await db.insert(pilots).values(data).returning();
}

export async function getPilot(id: string) {
  const result = await db.select().from(pilots).where(eq(pilots.id, id));

  return result[0];
}

export async function getActivePilot() {
  const result = await db
    .select()
    .from(pilots)
    .where(eq(pilots.isActive, true))
    .limit(1);

  return result[0] ?? null;
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
