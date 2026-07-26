import { db } from "../db";

import { messages, coachContexts } from "../db/schema";

import { eq, asc } from "drizzle-orm";

export async function getSessionMemory(sessionId: string) {
  const context = await db
    .select()
    .from(coachContexts)
    .where(eq(coachContexts.sessionId, sessionId));

  return context[0]?.summary ?? "";
}
