import OpenAI from "openai";
import { env } from "../env";

import { loadAppContext } from "./app-context.service";
import { buildCoachContext } from "./context.service";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

export async function askCoach(message: string, sessionId?: string) {
  const context = await loadAppContext(sessionId, message);

  const systemPrompt = buildCoachContext(context);

  const response = await client.responses.create({
    model: context.settings?.openAiModel ?? "gpt-5-mini",

    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],

    max_output_tokens:
      context.settings?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,

    // Prima il campo "temperature" delle impostazioni veniva salvato
    // ma mai passato qui: il form Impostazioni sembrava funzionare ma
    // non aveva alcun effetto reale sulle risposte.
    temperature: context.settings?.temperature ?? 0.7,
  });

  let text = response.output_text ?? "";

  if (!text && Array.isArray((response as any).output)) {
    text = (response as any).output
      .flatMap((item: any) => item.content ?? [])
      .filter((part: any) => part.type === "output_text")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
  }

  const truncated =
    (response as any).status === "incomplete" &&
    (response as any).incomplete_details?.reason === "max_output_tokens";

  if (!text) {
    text = truncated
      ? "Ho esaurito il budget di risposta prima di completare la risposta. Prova a riformulare la domanda in modo più mirato, oppure alza 'maxOutputTokens' nelle impostazioni."
      : "Non sono riuscito a generare una risposta. Riprova tra qualche secondo.";
  }

  return {
    text,
    usage: response.usage,
    truncated,
  };
}
