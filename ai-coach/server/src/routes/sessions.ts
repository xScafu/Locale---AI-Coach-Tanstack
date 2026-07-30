import { Hono } from "hono";
import {
  createSession,
  deleteSession,
  getSessionById,
  getSessions,
} from "../repositories/session.repository";
import { getMessagesBySession } from "../repositories/message.repository";

const sessions = new Hono();

sessions.post("/", async (c) => {
  const id = await createSession();
  return c.json({ id });
});

sessions.get("/", async (c) => {
  const items = await getSessions();
  return c.json({ items });
});

sessions.get("/:id", async (c) => {
  const id = c.req.param("id");
  const session = await getSessionById(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ session });
});

sessions.get("/:id/messages", async (c) => {
  const id = c.req.param("id");

  const session = await getSessionById(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const items = await getMessagesBySession(id);
  return c.json({ items });
});

sessions.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const session = await getSessionById(id);
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  await deleteSession(id);
  return c.json({ ok: true });
});

export default sessions;
