import { create } from 'zustand';
import type { ExamTask, ExamType, RejectTemplate, BatchTimeRange, PriorityLevel } from '../types';
import { generateMockRejectTemplates } from '../mock/data';
import { useTaskStore } from './useTaskStore';

interface BatchFilter {
  examType: ExamType | 'all';
  selectedExamTypes: ExamType[];
  minConfidence: number;
  noSignificantChange: boolean;
  onlyNormalPriority: boolean;
  timeRange: BatchTimeRange;
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
  selectedExamTypes: [],
  minConfidence: 0.85,
  noSignificantChange: true,
  onlyNormalPriority: false,
  timeRange: '7d',
};

function isInTimeRange(examTime: string, range: BatchTimeRange): boolean {
  if (range === 'all') return true;
  const now = new Date();
  const exam = new Date(examTime);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - exam.getTime()) / (1000 * 60 * 60 * 24));
  switch (range) {
    case 'today':
      return diffDays === 0;
    case '3d':
      return diffDays <= 2;
    case '7d':
      return diffDays <= 6;
    default:
      return true;
  }
}

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
      .filter((t) => t.status === 'pending' || t.status === 'timeout')
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
      if (task.status !== 'pending' && task.status !== 'timeout') return false;

      if (batchFilter.selectedExamTypes.length > 0) {
        if (!batchFilter.selectedExamTypes.includes(task.examType)) {
          return false;
        }
      } else if (batchFilter.examType !== 'all' && task.examType !== batchFilter.examType) {
        return false;
      }

      if (task.aiConfidence < batchFilter.minConfidence) {
        return false;
      }

      if (batchFilter.noSignificantChange && task.hasSignificantChange) {
        return false;
      }

      if (batchFilter.onlyNormalPriority && task.priority !== 'normal') {
        return false;
      }

      if (!isInTimeRange(task.examTime, batchFilter.timeRange)) {
        return false;
      }

      return true;
    });
  },
}));

export default useBatchStore;
