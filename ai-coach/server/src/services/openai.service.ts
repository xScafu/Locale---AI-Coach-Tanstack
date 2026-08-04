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

// L'output strutturato non e' supportato da tutti i modelli, e il
// modello e' scelto dall'utente in Impostazioni. Se l'API lo rifiuta si
// riprova senza: si perdono i suggerimenti strutturati, ma la chat
// continua a funzionare.
function isUnsupportedFormat(error: unknown) {
  if (!(error instanceof OpenAI.APIError) || error.status !== 400) return false;

  const param = error.param ?? "";
  const message = error.message ?? "";

  return (
    param.startsWith("text") ||
    /json_schema|response_format|structured output/i.test(message)
  );
}

async function createResponse(params: ResponseParams) {
  try {
    return await client.responses.create(params);
  } catch (error) {
    if (params.temperature !== undefined && isUnsupportedParam(error, "temperature")) {
      const { temperature: _ignored, ...withoutTemperature } = params;
      return await createResponse(withoutTemperature);
    }

    if (params.text !== undefined && isUnsupportedFormat(error)) {
      const { text: _ignored, ...withoutFormat } = params;
      return await createResponse(withoutFormat);
    }

    throw error;
  }
}

// Le modifiche viaggiano come delta di CLICK su una regolazione del
// file .svm, non come valore finale: l'interfaccia del gioco lavora a
// scatti e la scala indice-valore cambia da auto ad auto, quindi un
// valore assoluto non sarebbe convertibile.
//
// "setting" non e' un enum perche' le regolazioni disponibili dipendono
// dall'auto: l'elenco valido finisce nel prompt, e applyClicks scarta
// con motivazione quelle inesistenti o non regolabili.
export type SetupChange = {
  setting: string;
  deltaClicks: number;
  reason: string;
};

// Schema della risposta: la prosa resta in "reply", le modifiche
// proposte arrivano gia' strutturate in "setupChanges". Con strict
// l'API garantisce la forma, quindi il client non deve estrarre numeri
// dal testo libero — che era l'alternativa fragile.
const COACH_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  name: "coach_reply",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "La risposta al pilota, in italiano, formattata in markdown.",
      },
      setupChanges: {
        type: "array",
        description:
          "Modifiche al setup attivo, espresse in click. Vuoto se non se ne propongono o se non c'e' un setup attivo.",
        items: {
          type: "object",
          properties: {
            setting: {
              type: "string",
              description:
                "Percorso esatto della regolazione, es. FRONTLEFT.CamberSetting, preso dall'elenco nel contesto.",
            },
            deltaClicks: {
              type: "integer",
              description:
                "Di quanti scatti muovere l'indice: negativo per scendere.",
            },
            reason: {
              type: "string",
              description: "Perche' questa modifica, in una frase.",
            },
          },
          required: ["setting", "deltaClicks", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["reply", "setupChanges"],
    additionalProperties: false,
  },
};

function parseCoachPayload(raw: string): {
  reply: string;
  setupChanges: SetupChange[];
} {
  try {
    const parsed = JSON.parse(raw);

    if (typeof parsed?.reply === "string") {
      return {
        reply: parsed.reply,
        setupChanges: Array.isArray(parsed.setupChanges)
          ? parsed.setupChanges
          : [],
      };
    }
  } catch {
    // Non era JSON: si ricade sul testo cosi' com'e'.
  }

  // Se il modello ignora lo schema, o l'API lo rifiuta, meglio una
  // risposta senza suggerimenti strutturati che una chat rotta.
  return { reply: raw, setupChanges: [] };
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

    text: { format: COACH_RESPONSE_FORMAT },
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

  const payload = parseCoachPayload(text);

  text = payload.reply;

  if (!text) {
    text = truncated
      ? "Ho esaurito il budget di risposta prima di completare la risposta. Prova a riformulare la domanda in modo più mirato, oppure alza 'maxOutputTokens' nelle impostazioni."
      : "Non sono riuscito a generare una risposta. Riprova tra qualche secondo.";
  }

  return {
    text,
    setupChanges: payload.setupChanges,
    usage: response.usage,
    truncated,
  };
}
