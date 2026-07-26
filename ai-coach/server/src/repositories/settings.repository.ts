import { db } from "../db";
import { settings } from "../db/schema";

export async function getSettings() {
  const result = await db.select().from(settings).limit(1);

  return result[0] ?? null;
}
