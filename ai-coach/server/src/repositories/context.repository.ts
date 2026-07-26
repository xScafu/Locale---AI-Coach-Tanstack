import { db } from "../db";

import { coachContexts } from "../db/schema";

import { eq } from "drizzle-orm";

export async function updateMemory(sessionId: string, summary: string) {
  await db
    .update(coachContexts)
    .set({
      summary,
    })
    .where(eq(coachContexts.sessionId, sessionId));
}
