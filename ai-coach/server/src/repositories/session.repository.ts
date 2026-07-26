import { db } from "../db";

import { sessions } from "../db/schema";

export async function createSession() {
  const id = crypto.randomUUID();

  await db.insert(sessions).values({
    id,

    title: "Nuova sessione",

    createdAt: Date.now(),
  });

  return id;
}
