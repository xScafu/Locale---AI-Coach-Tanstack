import { Hono } from "hono";
import { createSession } from "../repositories/session.repository";

const sessions = new Hono();

// Prima non esisteva nessuna route per creare una sessione: il client
// partiva sempre con sessionId undefined e /api/chat rispondeva 400
// "sessionId required" al primo messaggio.
sessions.post("/", async (c) => {
  const id = await createSession();
  return c.json({ id });
});

export default sessions;
