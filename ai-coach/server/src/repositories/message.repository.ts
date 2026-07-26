import { db } from "../db";
import { eq, count } from "drizzle-orm";
import { messages } from "../db/schema";

export async function saveMessage(data: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  await db.insert(messages).values({
    ...data,

    createdAt: Date.now(),
  });
}

export async function countSessionMessages(sessionId: string) {
  const result = await db
    .select({
      total: count(),
    })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));

  return result[0].total;
}
