import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { telemetryImports } from "../db/schema.js";

export type TelemetryImportInsert = {
  id: string;
  carId?: string | null;
  trackId?: string | null;
  pilotId?: string | null;
  fileName: string;
  filePath: string;
  tables?: string | null;
  status: string;
  errorMessage?: string | null;
  // JSON dei metadata del file, copiati all'import.
  metadata?: string | null;
  recordedAt?: number | null;
};

export type TelemetryImportUpdate = Partial<Omit<TelemetryImportInsert, "id">>;

export async function createTelemetryImport(data: TelemetryImportInsert) {
  await db.insert(telemetryImports).values(data);
  return data;
}

export async function updateTelemetryImport(
  id: string,
  data: TelemetryImportUpdate
) {
  await db
    .update(telemetryImports)
    .set(data)
    .where(eq(telemetryImports.id, id));
}

export async function getTelemetryImportById(id: string) {
  const result = await db
    .select()
    .from(telemetryImports)
    .where(eq(telemetryImports.id, id));

  return result[0] ?? null;
}

export async function getTelemetryImports(carId?: string) {
  if (carId) {
    return db
      .select()
      .from(telemetryImports)
      .where(eq(telemetryImports.carId, carId))
      .orderBy(desc(telemetryImports.createdAt));
  }

  return db
    .select()
    .from(telemetryImports)
    .orderBy(desc(telemetryImports.createdAt));
}

export async function deleteTelemetryImport(id: string) {
  await db.delete(telemetryImports).where(eq(telemetryImports.id, id));
}
