import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { askCoach } from "../services/openai.service";
import { saveMessage } from "../repositories/message.repository";
import { checkMemoryUpdate } from "../services/memory.manager";
import { withSettingLabels } from "../services/svm.service";

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
    id: randomUUID(),
    sessionId,
    role: "user",
    content: message,
  });

  const result = await askCoach(message, sessionId);

  await saveMessage({
    id: randomUUID(),
    sessionId,
    role: "assistant",
    content: result.text,
    inputTokens: result.usage?.input_tokens,
    outputTokens: result.usage?.output_tokens,
    setupChanges: JSON.stringify(result.setupChanges ?? []),
  });

  // Prima questa funzione non veniva mai chiamata: il riassunto
  // automatico della memoria ogni N messaggi era codice morto.
  await checkMemoryUpdate(sessionId);

  return c.json({
    sessionId,
    answer: result.text,
    // Modifiche al setup proposte in questa risposta, gia' strutturate.
    // L'etichetta leggibile viene aggiunta qui e non duplicata lato
    // client: la mappa dei nomi vive in un posto solo.
    setupChanges: withSettingLabels(result.setupChanges),
    usage: result.usage,
  });
});

export default chat;
