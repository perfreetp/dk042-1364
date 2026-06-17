import { create } from 'zustand';
import type { UserPreferences } from '../types';
import { defaultUserPreferences } from '../mock/data';

type PreferencePatch = Partial<UserPreferences>;

const STORAGE_KEY = 'radreview:preferences';

function loadFromStorage(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultUserPreferences };
    const parsed = JSON.parse(raw);
    return { ...defaultUserPreferences, ...parsed };
  } catch (_e) {
    return { ...defaultUserPreferences };
  }
}

function saveToStorage(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (_e) {
    // ignore
  }
}

interface PreferenceState {
  preferences: UserPreferences;

  updatePreferences: (patch: PreferencePatch) => void;
  resetToDefaults: () => void;
}

const initialPrefs = loadFromStorage();

export const usePreferenceStore = create<PreferenceState>((set) => ({
  preferences: initialPrefs,

  updatePreferences: (patch) =>
    set((state) => {
      const next = { ...state.preferences, ...patch };
      saveToStorage(next);
      return { preferences: next };
    }),

  resetToDefaults: () => {
    saveToStorage(defaultUserPreferences);
    set({ preferences: { ...defaultUserPreferences } });
  },
}));

export default usePreferenceStore;
