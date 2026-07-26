import { db } from "../db";
import { pilots, cars, tracks, messages, coachContexts } from "../db/schema";

export async function getDashboardData() {
  const pilot = await db.select().from(pilots).limit(1);

  const car = await db.select().from(cars).limit(1);

  const track = await db.select().from(tracks).limit(1);

  const memory = await db.select().from(coachContexts).limit(1);

  const totalMessages = await db.select().from(messages);

  return {
    pilot: pilot[0] ?? null,
    car: car[0] ?? null,
    track: track[0] ?? null,
    memory: memory[0] ?? null,
    messages: totalMessages.length,
  };
}
