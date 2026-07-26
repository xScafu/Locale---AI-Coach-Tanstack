import { create } from "zustand";

type SettingsState = {
  model: string;
  setModel: (model: string) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  model: "gpt-5-mini",
  setModel: (model) => set({ model }),
}));
