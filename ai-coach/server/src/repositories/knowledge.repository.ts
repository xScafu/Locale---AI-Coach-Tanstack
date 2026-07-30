import { desc, eq, or, like } from "drizzle-orm";
import { db } from "../db";
import { knowledgeBase } from "../db/schema";

export type KnowledgeInsert = {
  id: string;
  category: string;
  title: string;
  content: string;
  tags?: string | null;
};

export type KnowledgeUpdate = Partial<Omit<KnowledgeInsert, "id">>;

export async function createKnowledgeEntry(data: KnowledgeInsert) {
  await db.insert(knowledgeBase).values(data);
  return data;
}

export async function getAllKnowledgeEntries() {
  return db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.createdAt));
}

export async function getKnowledgeEntryById(id: string) {
  const result = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, id));

  return result[0] ?? null;
}

export async function updateKnowledgeEntry(id: string, data: KnowledgeUpdate) {
  await db.update(knowledgeBase).set(data).where(eq(knowledgeBase.id, id));
}

export async function deleteKnowledgeEntry(id: string) {
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}

// Ricerca semplice per parole chiave su titolo/contenuto/tag. Usata sia
// dalla route GET /api/knowledge?q=... (ricerca manuale da UI) sia dal
// coach per recuperare le voci pertinenti al messaggio dell'utente.
// Ignora parole troppo corte (<=2 caratteri) per non far esplodere i
// risultati con articoli/preposizioni.
export async function searchKnowledgeEntries(query: string, limit = 5) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);

  if (words.length === 0) {
    return [];
  }

  const conditions = words.flatMap((word) => [
    like(knowledgeBase.title, `%${word}%`),
    like(knowledgeBase.content, `%${word}%`),
    like(knowledgeBase.tags, `%${word}%`),
  ]);

  return db
    .select()
    .from(knowledgeBase)
    .where(or(...conditions))
    .orderBy(desc(knowledgeBase.createdAt))
    .limit(limit);
}
