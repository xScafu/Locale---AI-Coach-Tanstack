import { create } from "zustand";

type PilotState = {
  pilotId: string | null;
  pilotName: string | null;
  setPilot: (pilotId: string, pilotName?: string | null) => void;
  clearPilot: () => void;
};

const STORAGE_KEY = "ai-coach-pilot";

function readStoredPilot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { pilotId: string; pilotName: string | null };
  } catch {
    return null;
  }
}

const stored = typeof window !== "undefined" ? readStoredPilot() : null;

export const usePilotStore = create<PilotState>((set) => ({
  pilotId: stored?.pilotId ?? null,
  pilotName: stored?.pilotName ?? null,

  setPilot: (pilotId, pilotName = null) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pilotId, pilotName }));

    set({ pilotId, pilotName });
  },

  clearPilot: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ pilotId: null, pilotName: null });
  },
}));
