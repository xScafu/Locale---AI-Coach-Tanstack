import { Hono } from "hono";
import {
  getSettings,
  updateSettings,
} from "../repositories/settings.repository";

const settings = new Hono();

settings.get("/", async (c) => {
  const current = await getSettings();
  return c.json({ settings: current });
});

settings.put("/", async (c) => {
  const body = await c.req.json();

  const updated = await updateSettings({
    openAiModel: body.openAiModel,
    maxInputTokens: body.maxInputTokens
      ? Number(body.maxInputTokens)
      : undefined,
    maxOutputTokens: body.maxOutputTokens
      ? Number(body.maxOutputTokens)
      : undefined,
    temperature:
      body.temperature !== undefined ? Number(body.temperature) : undefined,
    autoSummaryEvery: body.autoSummaryEvery
      ? Number(body.autoSummaryEvery)
      : undefined,
  });

  return c.json({ settings: updated });
});

export default settings;
