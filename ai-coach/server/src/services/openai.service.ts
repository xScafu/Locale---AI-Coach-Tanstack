import OpenAI from "openai";
import { env } from "../env";

import { loadAppContext } from "./app-context.service";
import { buildCoachContext } from "./context.service";

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

// Esplicitamente la variante non-streaming: con
// Parameters<typeof client.responses.create>[0] si prende l'unione
// streaming + non-streaming, e sul risultato spariscono output_text e
// usage perche' non esistono sullo Stream.
type ResponseParams = OpenAI.Responses.ResponseCreateParamsNonStreaming;

// I modelli "reasoning" (famiglia gpt-5, o1/o3/o4) non espongono il
// campionamento: passare "temperature" fa fallire la richiesta con
// 400 "Unsupported parameter". Gli altri modelli lo accettano.
//
// Il default del progetto e' gpt-5-mini, quindi senza questo controllo
// la chat e' rotta di serie.
function supportsTemperature(model: string) {
  return !/^(o\d|gpt-5)/.test(model);
}

// L'elenco qui sopra invecchia a ogni nuovo modello OpenAI. Se sbaglia
// per eccesso, l'API ce lo dice: in quel caso si riprova una volta
// sola senza il parametro, invece di far fallire la chat.
function isUnsupportedParam(error: unknown, param: string) {
  return (
    error instanceof OpenAI.APIError &&
    error.status === 400 &&
    error.param === param
  );
}

async function createResponse(params: ResponseParams) {
  try {
    return await client.responses.create(params);
  } catch (error) {
    if (params.temperature === undefined) throw error;
    if (!isUnsupportedParam(error, "temperature")) throw error;

    const { temperature: _ignored, ...withoutTemperature } = params;

    return await client.responses.create(withoutTemperature);
  }
}

export async function askCoach(message: string, sessionId?: string) {
  const context = await loadAppContext(sessionId, message);

  const systemPrompt = buildCoachContext(context);

  const model = context.settings?.openAiModel ?? "gpt-5-mini";

  const response = await createResponse({
    model,

    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],

    max_output_tokens:
      context.settings?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,

    // Prima il campo "temperature" delle impostazioni veniva salvato
    // ma mai passato qui: il form Impostazioni sembrava funzionare ma
    // non aveva alcun effetto reale sulle risposte. Ora viene passato,
    // ma solo ai modelli che lo accettano.
    ...(supportsTemperature(model)
      ? { temperature: context.settings?.temperature ?? 0.7 }
      : {}),
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
