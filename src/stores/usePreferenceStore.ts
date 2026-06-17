import { create } from 'zustand';
import type { UserPreferences } from '../types';
import { defaultUserPreferences } from '../mock/data';

type PreferencePatch = Partial<UserPreferences>;

interface PreferenceState {
  preferences: UserPreferences;

  updatePreferences: (patch: PreferencePatch) => void;
  resetToDefaults: () => void;
}

export const usePreferenceStore = create<PreferenceState>((set) => ({
  preferences: { ...defaultUserPreferences },

  updatePreferences: (patch) =>
    set((state) => ({
      preferences: { ...state.preferences, ...patch },
    })),

  resetToDefaults: () =>
    set({
      preferences: { ...defaultUserPreferences },
    }),
}));

export default usePreferenceStore;
