import { getActivePilot } from "../repositories/profile.repository";
import { getActiveCar } from "../repositories/car.repository";
import { getActiveTrack } from "../repositories/track.repository";
import { getSettings } from "../repositories/settings.repository";
import { getSessionMemory } from "./memory.service";

export async function loadAppContext(sessionId?: string) {
  const [pilot, car, track, settings, coachMemory] = await Promise.all([
    getActivePilot(),

    getActiveCar(),

    getActiveTrack(),

    getSettings(),

    sessionId ? getSessionMemory(sessionId) : Promise.resolve(""),
  ]);

  return {
    pilot,

    car,

    track,

    settings,

    coachMemory,
  };
}
