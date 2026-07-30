import { eq } from "drizzle-orm";
import { db } from "../db";
import { pilots, cars, tracks, messages, coachContexts } from "../db/schema";

export async function getDashboardData() {
  // Prima queste tre query erano un semplice .limit(1) senza filtro:
  // la dashboard mostrava il PRIMO record inserito, non quello attivo.
  // Divergeva quindi da tutto il resto dell'app (e dal contesto passato
  // al coach), e la cosa e' diventata evidente con l'import automatico,
  // che cambia pilota, auto e circuito attivi in un colpo solo.
  const pilot = await db
    .select()
    .from(pilots)
    .where(eq(pilots.isActive, true))
    .limit(1);

  const car = await db
    .select()
    .from(cars)
    .where(eq(cars.isActive, true))
    .limit(1);

  const track = await db
    .select()
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .limit(1);

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
