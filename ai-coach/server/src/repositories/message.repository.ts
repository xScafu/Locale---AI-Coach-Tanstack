import { and, asc, desc, eq, isNotNull, ne, count } from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";

export type MessageInsert = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  // JSON di SetupChange[] proposto dal coach in questa risposta.
  setupChanges?: string | null;
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

// L'ultima risposta del coach che conteneva modifiche al setup, a
// prescindere dalla sessione: la scheda Setup le rilegge da qui perche'
// la chat lato client non conserva lo storico.
//
// L'array vuoto viene salvato come "[]", quindi non basta isNotNull:
// serve escludere esplicitamente la stringa vuota di JSON.
export async function getLatestSetupChanges() {
  const result = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.role, "assistant"),
        isNotNull(messages.setupChanges),
        ne(messages.setupChanges, "[]")
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return result[0] ?? null;
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
