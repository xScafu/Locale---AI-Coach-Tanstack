import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { messages, sessions } from "../db/schema";

export async function createSession() {
  const id = randomUUID();

  await db.insert(sessions).values({
    id,
    title: "Nuova sessione",
  });

  return id;
}

// Conteggio messaggi via LEFT JOIN, per mostrare "N messaggi" in lista
// senza dover caricare l'intera conversazione di ogni sessione.
export async function getSessions() {
  return db
    .select({
      id: sessions.id,
      title: sessions.title,
      createdAt: sessions.createdAt,
      messageCount: sql<number>`COUNT(${messages.id})`.as("messageCount"),
    })
    .from(sessions)
    .leftJoin(messages, eq(messages.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.createdAt));
}

export async function getSessionById(id: string) {
  const result = await db.select().from(sessions).where(eq(sessions.id, id));
  return result[0] ?? null;
}

export async function deleteSession(id: string) {
  await db.delete(messages).where(eq(messages.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}
