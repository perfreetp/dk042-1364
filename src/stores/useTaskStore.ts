import { create } from 'zustand';
import type { ExamTask, ExamType, SortBy, TopBannerReceipt, PacsWriteReceipt } from '../types';
import { generateMockTasks } from '../mock/data';

interface TaskState {
  tasks: ExamTask[];
  selectedTaskId: string | null;
  filterExamType: ExamType | 'all';
  sortBy: SortBy;
  searchQuery: string;
  showTopBannerReceipt: TopBannerReceipt | null;

  setTasks: (tasks: ExamTask[]) => void;
  selectTask: (taskId: string | null) => void;
  setFilter: (examType: ExamType | 'all') => void;
  setSort: (sortBy: SortBy) => void;
  setSearch: (query: string) => void;
  passTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  getFilteredAndSortedTasks: () => ExamTask[];
  getFirstPendingTask: () => ExamTask | undefined;

  setTaskHasDraft: (taskId: string, savedAt?: string) => void;
  clearTaskHasDraft: (taskId: string) => void;

  startWriteTask: (taskId: string) => void;
  updateWriteProgress: (taskId: string, progress: number, message?: string) => void;
  completeWriteTask: (taskId: string, requestId: string, durationSeconds: number) => void;
  failWriteTask: (taskId: string, message: string) => void;
  retryWriteTask: (taskId: string) => void;

  showTopBanner: (receipt: TopBannerReceipt) => void;
  updateTopBannerProgress: (progress: number, message?: string) => void;
  clearTopBanner: () => void;
}

const priorityOrder: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  normal: 2,
};

function initTaskFields(task: ExamTask): ExamTask {
  return {
    ...task,
    writeStatus: task.writeStatus ?? 'idle',
    writeReceipt: task.writeReceipt ?? {
      status: task.writeStatus ?? 'idle',
      progress: 0,
      retryCount: 0,
    },
    hasDraft: task.hasDraft ?? false,
  };
}

const DRAFT_LOCAL_STORAGE_KEY = 'radreview:drafts';

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: generateMockTasks(30).map(initTaskFields),
  selectedTaskId: null,
  filterExamType: 'all',
  sortBy: 'sla',
  searchQuery: '',
  showTopBannerReceipt: null,

  setTasks: (tasks) => set({ tasks: tasks.map(initTaskFields) }),

  selectTask: (taskId) => {
    if (taskId) {
      try {
        const raw = localStorage.getItem(DRAFT_LOCAL_STORAGE_KEY);
        if (raw) {
          const drafts = JSON.parse(raw) as Record<string, { savedAt: string }>;
          if (drafts[taskId]) {
            set((state) => ({
              selectedTaskId: taskId,
              tasks: state.tasks.map((t) =>
                t.taskId === taskId
                  ? { ...t, hasDraft: true, lastDraftSavedAt: drafts[taskId].savedAt }
                  : t
              ),
            }));
            return;
          }
        }
      } catch (_e) {
        // ignore
      }
    }
    set({ selectedTaskId: taskId });
  },

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

  getFirstPendingTask: () => {
    const { tasks } = get();
    return tasks.find((t) => t.status === 'pending' || t.status === 'timeout');
  },

  setTaskHasDraft: (taskId, savedAt) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, hasDraft: true, lastDraftSavedAt: savedAt ?? new Date().toISOString() }
          : t
      ),
    })),

  clearTaskHasDraft: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, hasDraft: false, lastDraftSavedAt: undefined }
          : t
      ),
    })),

  startWriteTask: (taskId) => {
    const task = get().tasks.find((t) => t.taskId === taskId);
    if (!task) return;
    const now = new Date().toISOString();
    const receipt: PacsWriteReceipt = {
      status: 'writing',
      startedAt: now,
      progress: 0,
      retryCount: task.writeReceipt?.retryCount ?? 0,
      message: '正在连接 PACS...',
    };
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, writeStatus: 'writing', writeReceipt: receipt }
          : t
      ),
      showTopBannerReceipt: {
        status: 'writing',
        taskId,
        patientName: task.patient.name,
        progress: 0,
        message: '正在连接 PACS...',
      },
    }));
  },

  updateWriteProgress: (taskId, progress, message) =>
    set((state) => {
      const task = state.tasks.find((t) => t.taskId === taskId);
      if (!task || !task.writeReceipt) return {};
      const receipt: PacsWriteReceipt = {
        ...task.writeReceipt,
        progress,
        message: message ?? task.writeReceipt.message,
      };
      const banner = state.showTopBannerReceipt;
      let newBanner = state.showTopBannerReceipt;
      if (banner && banner.taskId === taskId) {
        newBanner = {
          ...banner,
          progress,
          message: message ?? banner.message,
        };
      }
      return {
        tasks: state.tasks.map((t) =>
          t.taskId === taskId
            ? { ...t, writeReceipt: receipt }
            : t
        ),
        showTopBannerReceipt: newBanner,
      };
    }),

  completeWriteTask: (taskId, requestId, durationSeconds) =>
    set((state) => {
      const task = state.tasks.find((t) => t.taskId === taskId);
      if (!task || !task.writeReceipt) return {};
      const now = new Date().toISOString();
      const receipt: PacsWriteReceipt = {
        ...task.writeReceipt,
        status: 'success',
        completedAt: now,
        progress: 100,
        requestId,
        message: '写入成功',
      };
      return {
        tasks: state.tasks.map((t) =>
          t.taskId === taskId
            ? {
                ...t,
                status: 'passed',
                writeStatus: 'success',
                writeReceipt: receipt,
                hasDraft: false,
                lastDraftSavedAt: undefined,
              }
            : t
        ),
        showTopBannerReceipt: {
          status: 'success',
          taskId,
          patientName: task.patient.name,
          requestId,
          durationSeconds,
          progress: 100,
        },
      };
    }),

  failWriteTask: (taskId, message) =>
    set((state) => {
      const task = state.tasks.find((t) => t.taskId === taskId);
      if (!task || !task.writeReceipt) return {};
      const retryCount = (task.writeReceipt.retryCount ?? 0) + 1;
      const receipt: PacsWriteReceipt = {
        ...task.writeReceipt,
        status: 'failed',
        progress: task.writeReceipt.progress,
        retryCount,
        message,
      };
      return {
        tasks: state.tasks.map((t) =>
          t.taskId === taskId
            ? { ...t, writeStatus: 'failed', writeReceipt: receipt }
            : t
        ),
        showTopBannerReceipt: {
          status: 'failed',
          taskId,
          patientName: task.patient.name,
          message,
          retryCount,
          progress: task.writeReceipt.progress,
        },
      };
    }),

  retryWriteTask: (taskId) => {
    get().startWriteTask(taskId);
  },

  showTopBanner: (receipt) => set({ showTopBannerReceipt: receipt }),

  updateTopBannerProgress: (progress, message) =>
    set((state) => {
      if (!state.showTopBannerReceipt) return {};
      return {
        showTopBannerReceipt: {
          ...state.showTopBannerReceipt,
          progress,
          message: message ?? state.showTopBannerReceipt.message,
        },
      };
    }),

  clearTopBanner: () => set({ showTopBannerReceipt: null }),
}));

export default useTaskStore;
