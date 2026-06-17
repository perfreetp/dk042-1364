import { create } from 'zustand';
import type { LesionMeasurement, CompareMode } from '../types';
import { generateMockLesions } from '../mock/data';

interface LesionState {
  lesions: LesionMeasurement[];
  selectedLesionId: string | null;
  compareMode: CompareMode;

  setLesionsForTask: (taskId: string) => void;
  selectLesion: (lesionId: string | null) => void;
  setCompareMode: (mode: CompareMode) => void;
}

export const useLesionStore = create<LesionState>((set, _get) => ({
  lesions: [],
  selectedLesionId: null,
  compareMode: 'split',

  setLesionsForTask: (taskId) => {
    const lesions = generateMockLesions(taskId);
    set({
      lesions,
      selectedLesionId: lesions.length > 0 ? lesions[0].id : null,
    });
  },

  selectLesion: (lesionId) => set({ selectedLesionId: lesionId }),

  setCompareMode: (mode) => set({ compareMode: mode }),
}));

export default useLesionStore;
