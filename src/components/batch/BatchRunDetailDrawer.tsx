import { useMemo } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { useBatchStore } from '@/stores/useBatchStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { cn, formatDateTime } from '@/utils';
import type {
  BatchRun,
  BatchTaskRun,
  ExamType,
  PacsWriteStatus,
} from '@/types';
import { EXAM_TYPE_BADGE } from '@/types';

function StageBadge({ status, stage }: { status: PacsWriteStatus; stage: string }) {
  const map: Record<PacsWriteStatus, { className: string }> = {
    idle: { className: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
    queued: { className: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
    writing: { className: 'bg-blue-900/60 border-blue-700 text-blue-300' },
    success: { className: 'bg-green-900/60 border-green-700 text-green-300' },
    failed: { className: 'bg-red-900/60 border-red-700 text-red-300' },
    'retry-wait': { className: 'bg-yellow-900/60 border-yellow-700 text-yellow-300' },
  };
  const cfg = map[status];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium border', cfg.className)}>
      {stage}
    </span>
  );
}

interface ProgressBarProps {
  value: number;
  status: PacsWriteStatus;
}

function ProgressBar({ value, status }: ProgressBarProps) {
  let color = 'bg-blue-500';
  if (status === 'success') color = 'bg-green-500';
  else if (status === 'failed') color = 'bg-red-500';
  else if (status === 'queued' || status === 'idle') color = 'bg-zinc-700';
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
      <div
        className={cn('h-full transition-all duration-300', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function MiniMetricCard({
  label,
  value,
  valueClassName,
  icon,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card-base p-2.5 flex-1">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold font-mono tabular-nums', valueClassName ?? 'text-zinc-100')}>
        {value}
      </div>
    </div>
  );
}

function BatchProgressBar({ batch }: { batch: BatchRun }) {
  const total = batch.totalCount;
  if (total === 0) return null;
  const successW = (batch.successCount / total) * 100;
  const failedW = (batch.failedCount / total) * 100;
  const pendingW = 100 - successW - failedW;
  return (
    <div className="w-full h-2.5 bg-zinc-800 rounded-sm overflow-hidden flex">
      {successW > 0 && (
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${successW}%` }}
        />
      )}
      {failedW > 0 && (
        <div
          className="h-full bg-red-500 transition-all duration-500"
          style={{ width: `${failedW}%` }}
        />
      )}
      {pendingW > 0 && (
        <div
          className="h-full bg-zinc-700 transition-all duration-500"
          style={{ width: `${pendingW}%` }}
        />
      )}
    </div>
  );
}

interface TaskTableRowProps {
  taskRun: BatchTaskRun;
  onRetry: () => void;
}

function TaskTableRow({ taskRun, onRetry }: TaskTableRowProps) {
  const canRetry = taskRun.writeStatus === 'failed';
  return (
    <tr className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
      <td className="px-3 py-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200">{taskRun.patientName}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5 font-mono">{taskRun.taskId.slice(-8)}</div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-mono font-semibold border',
            EXAM_TYPE_BADGE[taskRun.examType],
          )}
        >
          {taskRun.examType}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <StageBadge status={taskRun.writeStatus} stage={taskRun.stage} />
      </td>
      <td className="px-3 py-2.5 w-28">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar value={taskRun.progress} status={taskRun.writeStatus} />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 w-8 text-right">
            {taskRun.progress}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 w-14 text-center">
        {taskRun.retryCount > 0 ? (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono bg-orange-900/40 text-orange-300 border border-orange-800/50">
            {taskRun.retryCount}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 max-w-[140px]">
        {taskRun.writeStatus === 'failed' && taskRun.failReason ? (
          <span className="text-[11px] text-red-400 line-clamp-1">{taskRun.failReason}</span>
        ) : (
          <span className="text-[11px] text-zinc-600">-</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {taskRun.writeStatus === 'success' && taskRun.requestId ? (
          <span className="font-mono text-[10px] text-green-300">{taskRun.requestId}</span>
        ) : (
          <span className="text-[10px] text-zinc-600">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 w-16 text-right">
        {taskRun.writeStatus === 'success' ? (
          <div className="flex items-center justify-end">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
        ) : canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] font-medium bg-red-900/30 text-red-300 border border-red-800/50 hover:bg-red-800/50 hover:border-red-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重试
          </button>
        ) : (
          <span className="text-[10px] text-zinc-600">等待</span>
        )}
      </td>
    </tr>
  );
}

export default function BatchRunDetailDrawer() {
  const batchDetailDrawerOpen = useBatchStore((s) => s.batchDetailDrawerOpen);
  const currentBatchRun = useBatchStore((s) => s.currentBatchRun);
  const closeBatchDetailDrawer = useBatchStore((s) => s.closeBatchDetailDrawer);
  const retryFailedTasksInCurrentBatch = useBatchStore((s) => s.retryFailedTasksInCurrentBatch);
  const updateBatchTaskRun = useBatchStore((s) => s.updateBatchTaskRun);
  const retryWriteTask = useTaskStore((s) => s.retryWriteTask);

  const batch = currentBatchRun;

  const { avgDuration, typeDistribution } = useMemo(() => {
    if (!batch) return { avgDuration: 0, typeDistribution: [] as Array<[ExamType, number]> };
    const completed = batch.taskRuns.filter((t) => t.durationSeconds !== undefined);
    const avg = completed.length > 0
      ? Math.round(completed.reduce((s, t) => s + (t.durationSeconds ?? 0), 0) / completed.length)
      : 0;
    const typeMap = new Map<ExamType, number>();
    for (const tr of batch.taskRuns) {
      typeMap.set(tr.examType, (typeMap.get(tr.examType) ?? 0) + 1);
    }
    const dist = Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]);
    return { avgDuration: avg, typeDistribution: dist };
  }, [batch]);

  const failedCount = batch?.failedCount ?? 0;
  const totalCount = batch?.totalCount ?? 0;

  const handleRetrySingle = (taskId: string) => {
    retryWriteTask(taskId);

    const existing = batch?.taskRuns.find((tr) => tr.taskId === taskId);
    const newRetryCount = (existing?.retryCount ?? 0) + 1;

    updateBatchTaskRun(taskId, {
      writeStatus: 'writing',
      stage: '正在连接 PACS',
      progress: 0,
      retryCount: newRetryCount,
      failReason: undefined,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      requestId: undefined,
      durationSeconds: undefined,
    });

    const startTime = Date.now();

    setTimeout(() => {
      updateBatchTaskRun(taskId, { stage: '正在索引 DICOM 序列', progress: 25 });
    }, 1200);

    setTimeout(() => {
      updateBatchTaskRun(taskId, { stage: '正在生成结构化报告', progress: 50 });
    }, 2400);

    setTimeout(() => {
      updateBatchTaskRun(taskId, { stage: '正在写入 PACS 归档', progress: 75 });
    }, 3600);

    setTimeout(() => {
      const requestId = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const now = new Date().toISOString();

      const currentTask = useTaskStore.getState().tasks.find((t) => t.taskId === taskId);
      const finalStatus = currentTask?.writeStatus;

      if (finalStatus === 'success') {
        updateBatchTaskRun(taskId, {
          writeStatus: 'success',
          progress: 100,
          stage: '写入完成',
          requestId: currentTask.writeReceipt?.requestId ?? requestId,
          durationSeconds,
          completedAt: now,
          failReason: undefined,
        });
      } else if (finalStatus === 'failed') {
        updateBatchTaskRun(taskId, {
          writeStatus: 'failed',
          stage: `写入失败：${currentTask.writeReceipt?.message ?? '未知错误'}`,
          failReason: currentTask.writeReceipt?.message ?? '未知错误',
          durationSeconds,
          completedAt: now,
          progress: currentTask.writeReceipt?.progress ?? 75,
        });
      } else {
        updateBatchTaskRun(taskId, {
          writeStatus: 'success',
          progress: 100,
          stage: '写入完成',
          requestId,
          durationSeconds,
          completedAt: now,
        });
      }
    }, 4800);
  };

  return (
    <div className={cn('fixed inset-0 z-50', batchDetailDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          batchDetailDrawerOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={closeBatchDetailDrawer}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full w-[600px] max-w-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col transition-transform duration-200 ease-out',
          batchDetailDrawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="bg-zinc-800/80 border-b border-zinc-700 p-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-200">批次详情</span>
                <span className="text-xs font-mono text-medical-400 bg-medical-900/40 px-1.5 py-0.5 rounded-sm border border-medical-800/50">
                  {batch?.id ?? 'BAT-000000-XXXX'}
                </span>
                {batch?.status === 'running' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-blue-900/60 text-blue-300 border border-blue-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Running
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-zinc-700 text-zinc-300 border border-zinc-600">
                    Completed
                  </span>
                )}
              </div>
              {batch && (
                <div className="flex items-center gap-2 mt-2">
                  <BatchProgressBar batch={batch} />
                  <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums shrink-0">
                    <span className="text-green-400">{batch.successCount}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-red-400">{batch.failedCount}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-400">{batch.totalCount}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={closeBatchDetailDrawer}
              className="w-7 h-7 rounded-sm flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
          {batch && (
            <>
              <section className="card-base p-3">
                <div className="flex items-center gap-2 mb-3 text-[11px] text-zinc-500 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  批次概览
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <MiniMetricCard
                    label="总例数"
                    value={totalCount}
                    valueClassName="text-zinc-100"
                  />
                  <MiniMetricCard
                    label="成功"
                    value={batch.successCount}
                    valueClassName="text-green-400"
                  />
                  <MiniMetricCard
                    label="失败"
                    value={failedCount}
                    valueClassName={failedCount > 0 ? 'text-red-400' : 'text-zinc-500'}
                  />
                  <MiniMetricCard
                    label="平均耗时"
                    value={avgDuration > 0 ? `${avgDuration}s` : '-'}
                    valueClassName="text-medical-400"
                  />
                </div>
                <div className="flex items-center gap-4 text-[11px] text-zinc-400 border-t border-zinc-800 pt-2">
                  <div>
                    <span className="text-zinc-500">启动：</span>
                    <span className="font-mono">{formatDateTime(batch.startedAt)}</span>
                  </div>
                  {batch.completedAt && (
                    <div>
                      <span className="text-zinc-500">结束：</span>
                      <span className="font-mono">{formatDateTime(batch.completedAt)}</span>
                    </div>
                  )}
                </div>
                {typeDistribution.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                      按检查类型分布
                    </div>
                    <div className="space-y-1.5">
                      {typeDistribution.map(([type, count]) => {
                        const pct = Math.round((count / totalCount) * 100);
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-10 shrink-0 px-1 py-0.5 rounded-sm text-[10px] font-mono font-semibold border',
                                EXAM_TYPE_BADGE[type],
                              )}
                            >
                              {type}
                            </span>
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  type === 'CT' ? 'bg-blue-500' :
                                  type === 'MR' ? 'bg-purple-500' :
                                  type === 'DR' ? 'bg-emerald-500' :
                                  type === 'US' ? 'bg-cyan-500' :
                                  type === 'DSA' ? 'bg-orange-500' : 'bg-pink-500',
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-zinc-400 w-14 text-right">
                              {count} 例 ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="card-base flex flex-col overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-medium text-zinc-200">每例写入详情</h3>
                  <span className="text-[11px] text-zinc-500">{batch.taskRuns.length} 条记录</span>
                </div>
                <div className="flex-1 overflow-auto scrollbar-thin max-h-[calc(100vh-420px)]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10 border-b border-zinc-800">
                      <tr className="text-zinc-400 text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-2 font-medium">患者</th>
                        <th className="text-left px-3 py-2 font-medium w-12">类型</th>
                        <th className="text-left px-3 py-2 font-medium w-20">阶段</th>
                        <th className="text-left px-3 py-2 font-medium w-28">进度</th>
                        <th className="text-center px-3 py-2 font-medium w-14">重试</th>
                        <th className="text-left px-3 py-2 font-medium max-w-[140px]">失败原因</th>
                        <th className="text-left px-3 py-2 font-medium w-28">请求ID</th>
                        <th className="text-right px-3 py-2 font-medium w-16">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.taskRuns.map((tr) => (
                        <TaskTableRow
                          key={tr.taskId}
                          taskRun={tr}
                          onRetry={() => handleRetrySingle(tr.taskId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 bg-zinc-900/90 backdrop-blur border-t border-zinc-800 p-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={retryFailedTasksInCurrentBatch}
              disabled={failedCount === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-medium border transition-colors',
                failedCount > 0
                  ? 'bg-red-900/40 text-red-200 border-red-800/60 hover:bg-red-800/50 hover:border-red-700'
                  : 'bg-zinc-800/40 text-zinc-600 border-zinc-800 cursor-not-allowed',
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              仅重试失败 ({failedCount})
            </button>
            <button
              type="button"
              onClick={closeBatchDetailDrawer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
