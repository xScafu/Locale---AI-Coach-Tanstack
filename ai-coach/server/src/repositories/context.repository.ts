import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { coachContexts } from "../db/schema";

// Prima faceva solo UPDATE: se per quella sessione non esisteva ancora
// una riga in coach_context (caso normale per una sessione nuova),
// il salvataggio del riassunto era un no-op silenzioso e la memoria
// non veniva mai persistita. Ora fa upsert.
export async function updateMemory(sessionId: string, summary: string) {
  const existing = await db
    .select()
    .from(coachContexts)
    .where(eq(coachContexts.sessionId, sessionId));

  if (existing[0]) {
    await db
      .update(coachContexts)
      .set({ summary })
      .where(eq(coachContexts.sessionId, sessionId));
    return;
  }

  await db.insert(coachContexts).values({
    id: randomUUID(),
    sessionId,
    summary,
  });
}
