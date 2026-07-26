// profile.api.ts

import { api } from "./api";

export async function createProfile(data: any) {
  return api.post("/profile", data);
}
