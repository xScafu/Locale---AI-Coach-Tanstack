import { and, desc, eq } from "drizzle-orm";
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
  isReference?: boolean;
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

// Stesso schema di `deactivateSetups`: l'unicita' e' per circuito, non
// globale, quindi si azzerano solo i riferimenti della stessa pista.
// Un import senza trackId resta comunque marcabile — il confronto sa
// riconoscere il circuito dal nome nei metadata — ma non esclude
// nessuno.
export async function setReferenceImport(id: string, trackId: string | null) {
  if (trackId) {
    await db
      .update(telemetryImports)
      .set({ isReference: false })
      .where(
        and(
          eq(telemetryImports.trackId, trackId),
          eq(telemetryImports.isReference, true)
        )
      );
  }

  await db
    .update(telemetryImports)
    .set({ isReference: true })
    .where(eq(telemetryImports.id, id));
}

export async function clearReferenceImport(id: string) {
  await db
    .update(telemetryImports)
    .set({ isReference: false })
    .where(eq(telemetryImports.id, id));
}

export async function getReferenceImports() {
  return db
    .select()
    .from(telemetryImports)
    .where(eq(telemetryImports.isReference, true))
    .orderBy(desc(telemetryImports.createdAt));
}
