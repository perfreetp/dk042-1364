import { create } from 'zustand';
import type {
  ExamTask,
  ExamType,
  RejectTemplate,
  BatchTimeRange,
  PriorityLevel,
  BatchRun,
  BatchTaskRun,
} from '../types';
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

  currentBatchRun: BatchRun | null;
  batchDetailDrawerOpen: boolean;

  toggleTaskSelection: (taskId: string) => void;
  selectAllMatching: () => void;
  clearSelection: () => void;
  applyBatchPass: () => void;
  applyBatchReject: (templateId: string) => void;
  setBatchFilter: (filter: Partial<BatchFilter>) => void;
  getMatchingTasks: () => ExamTask[];

  openBatchDetailDrawer: () => void;
  closeBatchDetailDrawer: () => void;
  triggerBatchRun: (taskIds: string[]) => void;
  retryFailedTasksInCurrentBatch: () => void;
  updateBatchTaskRun: (taskId: string, patch: Partial<BatchTaskRun>) => void;
  isInTimeRange: (examTime: string, range: BatchTimeRange) => boolean;
}

const defaultBatchFilter: BatchFilter = {
  examType: 'all',
  selectedExamTypes: [],
  minConfidence: 0.85,
  noSignificantChange: true,
  onlyNormalPriority: false,
  timeRange: '7d',
};

export function isInTimeRange(examTime: string, range: BatchTimeRange): boolean {
  if (range === 'all') return true;
  const now = new Date();
  const exam = new Date(examTime);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOf3dAgo = new Date(startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
  const startOf7dAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  switch (range) {
    case 'today':
      return exam.getTime() >= startOfToday.getTime() && exam.getTime() < startOfTomorrow.getTime();
    case '3d':
      return exam.getTime() >= startOf3dAgo.getTime() && exam.getTime() < startOfTomorrow.getTime();
    case '7d':
      return exam.getTime() >= startOf7dAgo.getTime() && exam.getTime() < startOfTomorrow.getTime();
    default:
      return true;
  }
}

function generateBatchId(): string {
  return `BAT-${Date.now()}`;
}

function simulateTaskWriteFlow(
  taskId: string,
  onUpdate: (partial: Partial<BatchTaskRun>) => void,
  onComplete: (success: boolean, requestId?: string, durationSeconds?: number, failReason?: string) => void
): void {
  const taskStore = useTaskStore.getState();
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  setTimeout(() => {
    taskStore.startWriteTask(taskId);
    onUpdate({ writeStatus: 'writing', stage: '正在连接 PACS', progress: 0 });
  }, 500);

  setTimeout(() => {
    taskStore.updateWriteProgress(taskId, 25, '正在索引 DICOM 序列');
    onUpdate({ stage: '正在索引 DICOM 序列', progress: 25 });
  }, 1500);

  setTimeout(() => {
    taskStore.updateWriteProgress(taskId, 50, '正在生成结构化报告');
    onUpdate({ stage: '正在生成结构化报告', progress: 50 });
  }, 2500);

  setTimeout(() => {
    taskStore.updateWriteProgress(taskId, 75, '正在写入 PACS 归档');
    onUpdate({ stage: '正在写入 PACS 归档', progress: 75 });
  }, 3500);

  setTimeout(() => {
    const isSuccess = Math.random() < 0.8;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const now = new Date().toISOString();
    if (isSuccess) {
      taskStore.completeWriteTask(taskId, requestId, durationSeconds);
      onUpdate({
        writeStatus: 'success',
        progress: 100,
        stage: '写入完成',
        requestId,
        durationSeconds,
        completedAt: now,
      });
      onComplete(true, requestId, durationSeconds);
    } else {
      const failReason = 'PACS 归档服务响应超时';
      taskStore.failWriteTask(taskId, failReason);
      onUpdate({
        writeStatus: 'failed',
        stage: `写入失败：${failReason}`,
        failReason,
        retryCount: 1,
        completedAt: now,
      });
      onComplete(false, undefined, undefined, failReason);
    }
  }, 4500);
}

export const useBatchStore = create<BatchState>((set, get) => ({
  selectedTaskIds: [],
  batchFilter: defaultBatchFilter,
  rejectTemplates: generateMockRejectTemplates(),

  currentBatchRun: null,
  batchDetailDrawerOpen: false,

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

  openBatchDetailDrawer: () => set({ batchDetailDrawerOpen: true }),

  closeBatchDetailDrawer: () => set({ batchDetailDrawerOpen: false }),

  triggerBatchRun: (taskIds) => {
    const tasks = useTaskStore.getState().tasks;
    const taskRuns: BatchTaskRun[] = taskIds.map((taskId) => {
      const task = tasks.find((t) => t.taskId === taskId);
      return {
        taskId,
        patientName: task?.patient.name ?? '未知',
        examType: task?.examType ?? 'CT',
        writeStatus: 'queued',
        stage: '等待中',
        progress: 0,
        retryCount: task?.writeReceipt?.retryCount ?? 0,
      };
    });

    const batchRun: BatchRun = {
      id: generateBatchId(),
      startedAt: new Date().toISOString(),
      totalCount: taskIds.length,
      successCount: 0,
      failedCount: 0,
      status: 'running',
      taskRuns,
    };

    set({ currentBatchRun: batchRun, batchDetailDrawerOpen: true });

    const taskStore = useTaskStore.getState();
    taskStore.setTasks(
      taskStore.tasks.map((t) =>
        taskIds.includes(t.taskId) ? { ...t, currentBatchRunId: batchRun.id } : t
      )
    );

    let completedCount = 0;

    taskIds.forEach((taskId) => {
      simulateTaskWriteFlow(
        taskId,
        (partial) => {
          set((state) => {
            if (!state.currentBatchRun) return {};
            const updatedRuns = state.currentBatchRun.taskRuns.map((run) =>
              run.taskId === taskId ? { ...run, ...partial } : run
            );
            return {
              currentBatchRun: {
                ...state.currentBatchRun,
                taskRuns: updatedRuns,
              },
            };
          });
        },
        (success) => {
          completedCount++;
          set((state) => {
            if (!state.currentBatchRun) return {};
            const newSuccessCount = success
              ? state.currentBatchRun.successCount + 1
              : state.currentBatchRun.successCount;
            const newFailedCount = success
              ? state.currentBatchRun.failedCount
              : state.currentBatchRun.failedCount + 1;
            const isAllDone = completedCount >= state.currentBatchRun.totalCount;
            return {
              currentBatchRun: {
                ...state.currentBatchRun,
                successCount: newSuccessCount,
                failedCount: newFailedCount,
                status: isAllDone ? 'completed' : 'running',
                completedAt: isAllDone ? new Date().toISOString() : state.currentBatchRun.completedAt,
              },
            };
          });
        }
      );
    });
  },

  retryFailedTasksInCurrentBatch: () => {
    const { currentBatchRun } = get();
    if (!currentBatchRun) return;

    const failedTaskIds = currentBatchRun.taskRuns
      .filter((run) => run.writeStatus === 'failed')
      .map((run) => run.taskId);

    if (failedTaskIds.length === 0) return;

    get().triggerBatchRun(failedTaskIds);
  },

  updateBatchTaskRun: (taskId, patch) =>
    set((state) => {
      if (!state.currentBatchRun) return {};
      return {
        currentBatchRun: {
          ...state.currentBatchRun,
          taskRuns: state.currentBatchRun.taskRuns.map((tr) =>
            tr.taskId === taskId ? { ...tr, ...patch } : tr,
          ),
        },
      };
    }),

  isInTimeRange,
}));

export default useBatchStore;
