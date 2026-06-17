import { create } from 'zustand';
import type { ExamTask, ExamType, RejectTemplate } from '../types';
import { generateMockRejectTemplates } from '../mock/data';
import { useTaskStore } from './useTaskStore';

interface BatchFilter {
  examType: ExamType | 'all';
  minConfidence: number;
  noSignificantChange: boolean;
}

interface BatchState {
  selectedTaskIds: string[];
  batchFilter: BatchFilter;
  rejectTemplates: RejectTemplate[];

  toggleTaskSelection: (taskId: string) => void;
  selectAllMatching: () => void;
  clearSelection: () => void;
  applyBatchPass: () => void;
  applyBatchReject: (templateId: string) => void;
  setBatchFilter: (filter: Partial<BatchFilter>) => void;
  getMatchingTasks: () => ExamTask[];
}

const defaultBatchFilter: BatchFilter = {
  examType: 'all',
  minConfidence: 0.85,
  noSignificantChange: true,
};

export const useBatchStore = create<BatchState>((set, get) => ({
  selectedTaskIds: [],
  batchFilter: defaultBatchFilter,
  rejectTemplates: generateMockRejectTemplates(),

  toggleTaskSelection: (taskId) =>
    set((state) => {
      const isSelected = state.selectedTaskIds.includes(taskId);
      return {
        selectedTaskIds: isSelected
          ? state.selectedTaskIds.filter((id) => id !== taskId)
          : [...state.selectedTaskIds, taskId],
      };
    }),

  selectAllMatching: () => {
    const matchingTasks = get().getMatchingTasks();
    const pendingIds = matchingTasks
      .filter((t) => t.status === 'pending')
      .map((t) => t.taskId);
    set({ selectedTaskIds: pendingIds });
  },

  clearSelection: () => set({ selectedTaskIds: [] }),

  applyBatchPass: () => {
    const { selectedTaskIds } = get();
    const { passTask } = useTaskStore.getState();

    for (const taskId of selectedTaskIds) {
      passTask(taskId);
    }

    set({ selectedTaskIds: [] });
  },

  applyBatchReject: (templateId) => {
    const { selectedTaskIds, rejectTemplates } = get();
    const { rejectTask } = useTaskStore.getState();

    const template = rejectTemplates.find((t) => t.id === templateId);
    if (!template) return;

    for (const taskId of selectedTaskIds) {
      rejectTask(taskId);
    }

    set((state) => ({
      selectedTaskIds: [],
      rejectTemplates: state.rejectTemplates.map((t) =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + selectedTaskIds.length } : t
      ),
    }));
  },

  setBatchFilter: (filter) =>
    set((state) => ({
      batchFilter: { ...state.batchFilter, ...filter },
    })),

  getMatchingTasks: () => {
    const { batchFilter } = get();
    const tasks = useTaskStore.getState().tasks;

    return tasks.filter((task) => {
      if (task.status !== 'pending') return false;

      if (batchFilter.examType !== 'all' && task.examType !== batchFilter.examType) {
        return false;
      }

      if (task.aiConfidence < batchFilter.minConfidence) {
        return false;
      }

      if (batchFilter.noSignificantChange && task.hasSignificantChange) {
        return false;
      }

      return true;
    });
  },
}));

export default useBatchStore;
