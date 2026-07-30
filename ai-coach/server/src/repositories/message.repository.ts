import { asc, eq, count } from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";

export type MessageInsert = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export async function saveMessage(data: MessageInsert) {
  await db.insert(messages).values(data);
  return data;
}

export async function getMessagesBySession(sessionId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));
}

// Usata da memory.manager.ts (checkMemoryUpdate) per decidere quando
// generare il riassunto automatico ogni N messaggi.
export async function countSessionMessages(sessionId: string) {
  const result = await db
    .select({ value: count() })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));

  return result[0]?.value ?? 0;
}
