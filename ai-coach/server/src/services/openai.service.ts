import OpenAI from "openai";
import { env } from "../env";

import { loadAppContext } from "./app-context.service";
import { buildCoachContext } from "./context.service";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Prima la firma era (message, pilotId, sessionId) ma chat.ts chiamava
// askCoach(message, sessionId): il vero sessionId finiva nel parametro
// "pilotId" e loadAppContext(sessionId) riceveva sempre undefined,
// quindi la memoria di sessione non veniva mai caricata.
export async function askCoach(message: string, sessionId?: string) {
  const context = await loadAppContext(sessionId);

  const systemPrompt = await buildCoachContext(context);

  const response = await client.responses.create({
    model: context.settings?.openAiModel ?? "gpt-5-mini",

    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: message,
      },
    ],

    max_output_tokens: context.settings?.maxOutputTokens ?? 1000,
  });

  return {
    text: response.output_text,
    usage: response.usage,
  };
}
