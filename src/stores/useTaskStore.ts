import { create } from 'zustand';
import type { ExamTask, ExamType, SortBy, TopBannerReceipt, PacsWriteReceipt, ExamCategory, AuditEvent, AuditEventType, BatchTaskRun, BatchRun } from '../types';
import { generateMockTasks } from '../mock/data';

interface TaskState {
  tasks: ExamTask[];
  selectedTaskId: string | null;
  filterExamType: ExamType | 'all';
  filterExamCategory: ExamCategory;
  sortBy: SortBy;
  searchQuery: string;
  showTopBannerReceipt: TopBannerReceipt | null;
  detailDrawerOpen: boolean;
  currentDetailTaskId: string | null;

  setTasks: (tasks: ExamTask[]) => void;
  selectTask: (taskId: string | null) => void;
  setFilter: (examType: ExamType | 'all') => void;
  setFilterCategory: (category: ExamCategory) => void;
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

  openDetailDrawer: (taskId: string) => void;
  closeDetailDrawer: () => void;
  recordAuditEvent: (taskId: string, event: { type: AuditEventType; summary: string; details?: Record<string, unknown> }) => void;
  addAuditEvent: (taskId: string, type: AuditEventType, summary: string, details?: Record<string, unknown>) => void;
  getTaskAuditEvents: (taskId: string) => AuditEvent[];
}

const priorityOrder: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  normal: 2,
};

function generateAuditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DRAFT_LOCAL_STORAGE_KEY = 'radreview:drafts';
const AUDIT_LOCAL_STORAGE_KEY = 'radreview:audit';

function loadDraftMeta(taskId: string): { hasDraft: boolean; savedAt?: string } {
  try {
    const raw = localStorage.getItem(DRAFT_LOCAL_STORAGE_KEY);
    if (!raw) return { hasDraft: false };
    const all = JSON.parse(raw) as Record<string, { savedAt: string }>;
    const meta = all[taskId];
    return meta ? { hasDraft: true, savedAt: meta.savedAt } : { hasDraft: false };
  } catch (_e) {
    return { hasDraft: false };
  }
}

function loadAuditEventsForTask(taskId: string): AuditEvent[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, AuditEvent[]>;
    return all[taskId] ?? [];
  } catch (_e) {
    return [];
  }
}

function persistAuditEventsForTask(taskId: string, events: AuditEvent[]): void {
  try {
    const raw = localStorage.getItem(AUDIT_LOCAL_STORAGE_KEY);
    const all: Record<string, AuditEvent[]> = raw ? JSON.parse(raw) : {};
    all[taskId] = events;
    localStorage.setItem(AUDIT_LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

function initTaskFields(task: ExamTask): ExamTask {
  const storedAudit = loadAuditEventsForTask(task.taskId);
  const draftMeta = loadDraftMeta(task.taskId);
  return {
    ...task,
    writeStatus: task.writeStatus ?? 'idle',
    writeReceipt: task.writeReceipt ?? {
      status: task.writeStatus ?? 'idle',
      progress: 0,
      retryCount: 0,
    },
    hasDraft: draftMeta.hasDraft || (task.hasDraft ?? false),
    lastDraftSavedAt: draftMeta.savedAt ?? task.lastDraftSavedAt,
    auditEvents: storedAudit.length > 0 ? storedAudit : (task.auditEvents ?? []),
  };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: generateMockTasks(30).map(initTaskFields),
  selectedTaskId: null,
  filterExamType: 'all',
  filterExamCategory: 'all',
  sortBy: 'sla',
  searchQuery: '',
  showTopBannerReceipt: null,
  detailDrawerOpen: false,
  currentDetailTaskId: null,

  setTasks: (tasks) => set({ tasks: tasks.map(initTaskFields) }),

  selectTask: (taskId) => {
    if (taskId) {
      try {
        const raw = localStorage.getItem(DRAFT_LOCAL_STORAGE_KEY);
        if (raw) {
          const drafts = JSON.parse(raw) as Record<string, { savedAt: string }>;
          if (drafts[taskId]) {
            get().addAuditEvent(taskId, 'task-selected', '进入任务审核视图（草稿已恢复）');
            get().addAuditEvent(taskId, 'draft-loaded', '从本地恢复草稿，包含上次的语句取舍与修改');
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
      get().addAuditEvent(taskId, 'task-selected', '进入任务审核视图');
    }
    set({ selectedTaskId: taskId });
  },

  setFilter: (examType) => set({ filterExamType: examType }),

  setFilterCategory: (category) => set({ filterExamCategory: category, filterExamType: 'all' }),

  setSort: (sortBy) => set({ sortBy }),

  setSearch: (query) => set({ searchQuery: query }),

  passTask: (taskId) => {
    get().addAuditEvent(taskId, 'task-passed', '审核通过，等待写入 PACS');
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status: 'passed' } : t
      ),
    }));
  },

  rejectTask: (taskId) => {
    get().addAuditEvent(taskId, 'task-rejected', '审核驳回，标记人工复核');
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status: 'rejected' } : t
      ),
    }));
  },

  getFilteredAndSortedTasks: () => {
    const { tasks, filterExamType, filterExamCategory, sortBy, searchQuery } = get();

    let result = [...tasks];

    if (filterExamCategory !== 'all') {
      if (filterExamCategory === 'other') {
        result = result.filter((t) => t.examType === 'DSA' || t.examType === 'MG');
      } else {
        result = result.filter((t) => t.examType === filterExamCategory);
      }
    } else if (filterExamType !== 'all') {
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

  setTaskHasDraft: (taskId, savedAt) => {
    const time = savedAt ?? new Date().toISOString();
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId
          ? { ...t, hasDraft: true, lastDraftSavedAt: time }
          : t
      ),
    }));
  },

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
    const existingReceipt = task.writeReceipt;
    let historyReceipts = existingReceipt?.historyReceipts ?? [];
    if (existingReceipt && existingReceipt.status !== 'idle' && existingReceipt.status !== 'writing') {
      const { historyReceipts: _hr, ...rest } = existingReceipt;
      historyReceipts = [...historyReceipts, rest];
    }
    const receipt: PacsWriteReceipt = {
      status: 'writing',
      startedAt: now,
      progress: 0,
      retryCount: existingReceipt?.retryCount ?? 0,
      message: '正在连接 PACS...',
      historyReceipts,
    };
    get().addAuditEvent(taskId, existingReceipt && existingReceipt.retryCount > 0 ? 'write-retried' : 'write-started',
      existingReceipt && existingReceipt.retryCount > 0 ? `第 ${existingReceipt.retryCount + 1} 次重试写入` : '开始 PACS 写入流程');
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
      if (progress === 25 || progress === 50 || progress === 75) {
        get().addAuditEvent(taskId, 'write-progress', `写入进度 ${progress}%${message ? `：${message}` : ''}`);
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
      get().addAuditEvent(taskId, 'write-success', `PACS 写入成功，请求ID：${requestId}，耗时 ${durationSeconds}s`, {
        requestId,
        durationSeconds,
      });
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
      const now = new Date().toISOString();
      const retryCount = (task.writeReceipt.retryCount ?? 0) + 1;
      const receipt: PacsWriteReceipt = {
        ...task.writeReceipt,
        status: 'failed',
        progress: task.writeReceipt.progress,
        retryCount,
        message,
        completedAt: now,
      };
      const durationMs = task.writeReceipt.startedAt
        ? new Date(now).getTime() - new Date(task.writeReceipt.startedAt).getTime()
        : 0;
      const durationSeconds = Math.round(durationMs / 1000);
      get().addAuditEvent(taskId, 'write-failed', `写入失败：${message}（第 ${retryCount} 次）`, {
        failReason: message,
        retryCount,
        failedAt: now,
        failedProgress: task.writeReceipt.progress,
        durationSeconds,
      });
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

    let currentBatch: { updateBatchTaskRun?: (taskId: string, patch: Partial<BatchTaskRun>) => void; getCurrentBatch?: () => BatchRun | null } = {};
    try {
      const { useBatchStore } = require('./useBatchStore');
      currentBatch = {
        updateBatchTaskRun: useBatchStore.getState().updateBatchTaskRun,
        getCurrentBatch: () => useBatchStore.getState().currentBatchRun,
      };
    } catch (_e) {
      // ignore
    }

    const syncBatch = (patch: Partial<BatchTaskRun>) => {
      const batch = currentBatch.getCurrentBatch?.();
      if (batch && currentBatch.updateBatchTaskRun && batch.taskRuns.some((tr) => tr.taskId === taskId)) {
        currentBatch.updateBatchTaskRun(taskId, patch);
      }
    };

    const existing = currentBatch.getCurrentBatch?.()?.taskRuns.find((tr) => tr.taskId === taskId);
    const newRetryCount = (existing?.retryCount ?? 0) + 1;
    syncBatch({
      writeStatus: 'writing',
      stage: '连接PACS',
      progress: 0,
      retryCount: newRetryCount,
      failReason: undefined,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      requestId: undefined,
      durationSeconds: undefined,
    });

    const simulateStep = (progress: number, stage: string, delay: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          get().updateWriteProgress(taskId, progress, stage);
          syncBatch({ progress, stage });
          resolve();
        }, delay);
      });

    (async () => {
      await simulateStep(25, '正在索引检查序列', 1200);
      await simulateStep(50, '正在生成结构化报告', 1200);
      await simulateStep(75, '正在写入归档数据库', 1200);

      const isSuccess = Math.random() < 0.8;
      const durationSeconds = 4 + Math.round(Math.random() * 2);
      const requestId = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      if (isSuccess) {
        get().completeWriteTask(taskId, requestId, durationSeconds);
        syncBatch({
          writeStatus: 'success',
          stage: '成功',
          progress: 100,
          requestId,
          durationSeconds,
          completedAt: new Date().toISOString(),
          failReason: undefined,
        });
      } else {
        const reasons = [
          'PACS 服务端响应超时',
          '结构化报告字段校验失败',
          '归档数据库连接中断',
          '检查UID已存在冲突',
        ];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        get().failWriteTask(taskId, reason);
        syncBatch({
          writeStatus: 'failed',
          stage: '失败',
          failReason: reason,
          durationSeconds,
          completedAt: new Date().toISOString(),
          progress: 75,
        });
      }
    })();
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

  openDetailDrawer: (taskId) => {
    set({ detailDrawerOpen: true, currentDetailTaskId: taskId });
  },

  closeDetailDrawer: () => {
    set({ detailDrawerOpen: false });
  },

  addAuditEvent: (taskId, type, summary, details) => {
    const event: AuditEvent = {
      id: generateAuditId(),
      taskId,
      type,
      timestamp: new Date().toISOString(),
      operator: '当前用户',
      summary,
      details,
    };
    set((state) => {
      const tasks = state.tasks.map((t) => {
        if (t.taskId !== taskId) return t;
        const events = [...(t.auditEvents ?? []), event];
        persistAuditEventsForTask(taskId, events);
        return { ...t, auditEvents: events };
      });
      return { tasks };
    });
  },

  recordAuditEvent: (taskId, event) => {
    get().addAuditEvent(taskId, event.type, event.summary, event.details);
  },

  getTaskAuditEvents: (taskId) => {
    const task = get().tasks.find((t) => t.taskId === taskId);
    return task?.auditEvents ?? [];
  },
}));

export default useTaskStore;
