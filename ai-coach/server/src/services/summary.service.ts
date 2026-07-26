import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummary(conversation: string) {
  const response = await client.responses.create({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",

        content: `
                Sei un sistema di memoria per un AI Coach.

                Analizza la conversazione.

                Estrai solo informazioni permanenti:

                - stile di guida
                - errori ricorrenti
                - preferenze
                - obiettivi
                - problemi tecnici

                Non inserire dettagli temporanei.
                `,
      },

      {
        role: "user",

        content: conversation,
      },
    ],
  });

  return response.output_text;
}
