import { randomUUID } from "node:crypto";
import { db } from "../db";
import { sessions } from "../db/schema";

export async function createSession() {
  const id = randomUUID();

  await db.insert(sessions).values({
    id,
    title: "Nuova sessione",
    createdAt: Date.now(),
  });
  console.log(id);
  return id;
}
