import { eq } from "drizzle-orm";
import { db } from "../db";
import { coachContexts } from "../db/schema";

export async function getSessionMemory(sessionId: string) {
  const context = await db
    .select()
    .from(coachContexts)
    .where(eq(coachContexts.sessionId, sessionId));

  return context[0]?.summary ?? "";
}
