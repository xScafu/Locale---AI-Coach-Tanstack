import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "../db/schema";

const SETTINGS_ID = "default";

export type SettingsUpdate = Partial<{
  openAiModel: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  autoSummaryEvery: number;
}>;

export async function getSettings() {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID));

  return result[0] ?? null;
}

export async function updateSettings(data: SettingsUpdate) {
  const existing = await getSettings();

  if (existing) {
    await db.update(settings).set(data).where(eq(settings.id, SETTINGS_ID));
  } else {
    await db.insert(settings).values({ id: SETTINGS_ID, ...data });
  }

  return getSettings();
}
