import { eq } from "drizzle-orm";
import { db } from "../db";
import { carProblems } from "../db/schema";

export type ProblemInsert = {
  id: string;
  carId: string;
  phase: string;
  problem: string;
  severity?: number | null;
  notes?: string | null;
};

export type ProblemUpdate = Partial<Omit<ProblemInsert, "id" | "carId">>;

export async function createProblem(data: ProblemInsert) {
  await db.insert(carProblems).values(data);
  return data;
}

export async function getProblemsByCar(carId: string) {
  return db.select().from(carProblems).where(eq(carProblems.carId, carId));
}

export async function getProblemById(id: string) {
  const result = await db
    .select()
    .from(carProblems)
    .where(eq(carProblems.id, id));
  return result[0] ?? null;
}

export async function updateProblem(id: string, data: ProblemUpdate) {
  await db.update(carProblems).set(data).where(eq(carProblems.id, id));
}

export async function deleteProblem(id: string) {
  await db.delete(carProblems).where(eq(carProblems.id, id));
}
