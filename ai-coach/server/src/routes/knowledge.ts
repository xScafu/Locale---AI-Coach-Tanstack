import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getAllKnowledgeEntries,
  getKnowledgeEntryById,
  searchKnowledgeEntries,
  updateKnowledgeEntry,
} from "../repositories/knowledge.repository";

const knowledge = new Hono();

// GET /api/knowledge          -> tutte le voci
// GET /api/knowledge?q=parola -> ricerca per keyword (usata anche dalla UI)
knowledge.get("/", async (c) => {
  const q = c.req.query("q");

  const items = q
    ? await searchKnowledgeEntries(q, 20)
    : await getAllKnowledgeEntries();

  return c.json({ items });
});

knowledge.get("/:id", async (c) => {
  const id = c.req.param("id");
  const entry = await getKnowledgeEntryById(id);

  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({ entry });
});

knowledge.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.category || !body.title || !body.content) {
    return c.json({ error: "category, title and content are required" }, 400);
  }

  const id = randomUUID();

  await createKnowledgeEntry({
    id,
    category: body.category,
    title: body.title,
    content: body.content,
    tags: body.tags ?? null,
  });

  return c.json({ id });
});

knowledge.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await getKnowledgeEntryById(id);
  if (!existing) {
    return c.json({ error: "Entry not found" }, 404);
  }

  if (!body.category || !body.title || !body.content) {
    return c.json({ error: "category, title and content are required" }, 400);
  }

  await updateKnowledgeEntry(id, {
    category: body.category,
    title: body.title,
    content: body.content,
    tags: body.tags ?? null,
  });

  return c.json({ ok: true });
});

knowledge.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await getKnowledgeEntryById(id);
  if (!existing) {
    return c.json({ error: "Entry not found" }, 404);
  }

  await deleteKnowledgeEntry(id);

  return c.json({ ok: true });
});

export default knowledge;
