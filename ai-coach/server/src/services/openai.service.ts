import OpenAI from "openai";
import { env } from "../env";

import { loadAppContext } from "./app-context.service";
import { buildCoachContext } from "./context.service";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function askCoach(
  message: string,
  pilotId: string,
  sessionId?: string
) {
  const context = await loadAppContext(sessionId);

  const systemPrompt = buildCoachContext(context);

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
