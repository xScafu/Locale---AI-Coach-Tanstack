import "dotenv/config";

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",

  PORT: Number(process.env.PORT ?? 3001),
};
