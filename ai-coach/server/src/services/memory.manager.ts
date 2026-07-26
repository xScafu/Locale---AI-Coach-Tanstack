import { countSessionMessages } from "../repositories/message.repository";
import { generateSummary } from "./summary.service";
import { updateMemory } from "../repositories/context.repository";
import { db } from "../db";
import { messages } from "../db/schema";
import { eq, asc } from "drizzle-orm";

export async function checkMemoryUpdate(sessionId: string) {
  const total = await countSessionMessages(sessionId);

  if (total % 20 !== 0) {
    return;
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  const text = history.map((m) => `${m.role}: ${m.content}`).join("\n");

  const summary = await generateSummary(text);

  await updateMemory(sessionId, summary);
}
