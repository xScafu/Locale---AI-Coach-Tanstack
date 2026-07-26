import { Hono } from "hono";
import { askCoach } from "../services/openai.service";
import { saveMessage } from "../repositories/message.repository";

const chat = new Hono();

chat.post("/", async (c) => {
  const body = await c.req.json();

  const message = body.message;
  const sessionId = body.sessionId;

  if (!message) {
    return c.json({ error: "Message required" }, 400);
  }

  if (!sessionId) {
    return c.json({ error: "sessionId required" }, 400);
  }

  await saveMessage({
    id: crypto.randomUUID(),
    sessionId,
    role: "user",
    content: message,
  });

  const result = await askCoach(message, sessionId);

  await saveMessage({
    id: crypto.randomUUID(),
    sessionId,
    role: "assistant",
    content: result.text,
    inputTokens: result.usage?.input_tokens,
    outputTokens: result.usage?.output_tokens,
  });

  return c.json({
    sessionId,
    answer: result.text,
    usage: result.usage,
  });
});

export default chat;
