import { create } from 'zustand';
import type { ExamTask, ExamType, SortBy } from '../types';
import { generateMockTasks } from '../mock/data';

interface TaskState {
  tasks: ExamTask[];
  selectedTaskId: string | null;
  filterExamType: ExamType | 'all';
  sortBy: SortBy;
  searchQuery: string;

  setTasks: (tasks: ExamTask[]) => void;
  selectTask: (taskId: string | null) => void;
  setFilter: (examType: ExamType | 'all') => void;
  setSort: (sortBy: SortBy) => void;
  setSearch: (query: string) => void;
  passTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  getFilteredAndSortedTasks: () => ExamTask[];
}

const priorityOrder: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  normal: 2,
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: generateMockTasks(30),
  selectedTaskId: null,
  filterExamType: 'all',
  sortBy: 'sla',
  searchQuery: '',

  setTasks: (tasks) => set({ tasks }),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setFilter: (examType) => set({ filterExamType: examType }),

  setSort: (sortBy) => set({ sortBy }),

  setSearch: (query) => set({ searchQuery: query }),

  passTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status: 'passed' } : t
      ),
    })),

  rejectTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status: 'rejected' } : t
      ),
    })),

  getFilteredAndSortedTasks: () => {
    const { tasks, filterExamType, sortBy, searchQuery } = get();

    let result = [...tasks];

    if (filterExamType !== 'all') {
      result = result.filter((t) => t.examType === filterExamType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.patient.name.toLowerCase().includes(q) ||
          t.patient.id.toLowerCase().includes(q) ||
          t.taskId.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'sla': {
          const slaDiff =
            new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
          if (slaDiff !== 0) return slaDiff;
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'time':
          return (
            new Date(b.receiveTime).getTime() - new Date(a.receiveTime).getTime()
          );
        case 'confidence':
          return b.aiConfidence - a.aiConfidence;
        default:
          return 0;
      }
    });

    return result;
  },
}));

export default useTaskStore;
