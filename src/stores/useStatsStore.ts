import { create } from 'zustand';
import type { PersonalStats } from '../types';
import { generateMockStats } from '../mock/data';

interface StatsState {
  period: '7d' | '30d';
  stats: PersonalStats;

  setPeriod: (period: '7d' | '30d') => void;
  refreshStats: () => void;
}

export const useStatsStore = create<StatsState>((set) => ({
  period: '7d',
  stats: generateMockStats('7d'),

  setPeriod: (period) =>
    set({
      period,
      stats: generateMockStats(period),
    }),

  refreshStats: () =>
    set((state) => ({
      stats: generateMockStats(state.period),
    })),
}));

export default useStatsStore;
