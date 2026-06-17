import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ArrowLeftRight,
} from 'lucide-react';
import { useTaskStore } from '@/stores/useTaskStore';
import { useReportStore } from '@/stores/useReportStore';
import { usePreferenceStore } from '@/stores/usePreferenceStore';
import { cn, formatDateTime, formatSlaRemaining, formatConfidence } from '@/utils';
import type {
  ExamTask,
  AuditEvent,
  PacsWriteReceipt,
  SuggestionSentence,
  PacsWriteStatus,
  PriorityLevel,
} from '@/types';
import {
  AUDIT_EVENT_TYPE_LABEL,
  AUDIT_EVENT_TYPE_COLOR,
  EXAM_TYPE_BADGE,
} from '@/types';

function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  switch (priority) {
    case 'emergency':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-red-600 text-white border border-red-500">
          急诊
        </span>
      );
    case 'urgent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-yellow-400 text-zinc-900 border border-yellow-500">
          加急
        </span>
      );
    case 'normal':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-zinc-700 text-zinc-400 border border-zinc-600">
          常规
        </span>
      );
  }
}

function WriteTimelineIcon({ status }: { status: PacsWriteStatus }) {
  if (status === 'success') {
    return (
      <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500/30" />
    );
  }
  if (status === 'failed') {
    return (
      <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/30" />
    );
  }
  return (
    <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30 animate-pulse" />
  );
}

function WriteStatusBadge({ status }: { status: PacsWriteStatus }) {
  const map: Record<PacsWriteStatus, { label: string; className: string }> = {
    idle: { label: '待写入', className: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
    queued: { label: '排队中', className: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
    writing: { label: '写入中', className: 'bg-blue-900/60 border-blue-700 text-blue-300' },
    success: { label: '成功', className: 'bg-green-900/60 border-green-700 text-green-300' },
    failed: { label: '失败', className: 'bg-red-900/60 border-red-700 text-red-300' },
    'retry-wait': { label: '等待重试', className: 'bg-yellow-900/60 border-yellow-700 text-yellow-300' },
  };
  const cfg = map[status];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium border', cfg.className)}>
      {cfg.label}
    </span>
  );
}

interface AuditEventItemProps {
  event: AuditEvent;
  isLast: boolean;
}

function AuditEventItem({ event, isLast }: AuditEventItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = event.details && Object.keys(event.details).length > 0;
  const showExpandable = hasDetails && (
    event.type === 'sentence-edited' ||
    event.type === 'write-failed' ||
    event.type === 'write-success'
  );
  const timeStr = event.timestamp.slice(11, 19);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('w-3 h-3 rounded-full mt-1 ring-2 ring-zinc-900', AUDIT_EVENT_TYPE_COLOR[event.type])} />
        {!isLast && <div className="flex-1 w-px bg-zinc-800 my-1" />}
      </div>
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-100">
            {AUDIT_EVENT_TYPE_LABEL[event.type]}
          </span>
          <span className="text-xs text-zinc-500 font-mono tabular-nums">{timeStr}</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-500">{event.operator}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{event.summary}</p>
        {showExpandable && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-medical-400 hover:text-medical-300 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              查看详情
            </button>
            {expanded && (
              <div className="mt-2 p-2 rounded-sm bg-zinc-800/60 border border-zinc-700 text-xs space-y-1">
                {event.type === 'sentence-edited' && (
                  <>
                    <div>
                      <div className="text-zinc-500 mb-0.5">修改前：</div>
                      <div className="revision-delete">{String(event.details?.beforeText ?? '')}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-0.5">修改后：</div>
                      <div className="revision-insert">{String(event.details?.afterText ?? '')}</div>
                    </div>
                  </>
                )}
                {event.type === 'write-failed' && (
                  <div className="text-red-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{String(event.details?.failReason ?? event.summary)}</span>
                  </div>
                )}
                {event.type === 'write-success' && (
                  <div className="space-y-0.5 text-zinc-300">
                    <div>请求ID：<span className="font-mono text-green-300">{String(event.details?.requestId ?? '')}</span></div>
                    <div>耗时：<span className="font-mono">{String(event.details?.durationSeconds ?? '')}s</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SentenceItemProps {
  sentence: SuggestionSentence;
}

function SentenceItem({ sentence }: SentenceItemProps) {
  const categoryLabel = {
    finding: '发现',
    impression: '印象',
    measurement: '测量',
  }[sentence.category];
  const categoryBadge = {
    finding: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
    impression: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
    measurement: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  }[sentence.category];

  const base = 'p-2.5 rounded-sm border text-xs leading-relaxed';
  let content: React.ReactNode = null;
  let borderClass = '';

  if (sentence.decision === 'remove') {
    borderClass = 'border-zinc-800 bg-zinc-900/30';
    content = <span className="revision-delete">{sentence.content}</span>;
  } else if (sentence.decision === 'edit') {
    borderClass = 'border-medical-700/50 bg-medical-900/10';
    content = (
      <div className="space-y-1">
        <div className="revision-delete">{sentence.content}</div>
        <div className="flex items-center gap-1.5 text-zinc-600">
          <ArrowLeftRight className="w-3 h-3" />
          <span className="text-[10px]">修改为</span>
        </div>
        <div className="revision-insert">{sentence.editedContent ?? sentence.content}</div>
      </div>
    );
  } else {
    borderClass = 'border-green-800/50 bg-green-900/10';
    content = <span className="text-zinc-200">{sentence.content}</span>;
  }

  return (
    <div className={cn(base, borderClass)}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium border', categoryBadge)}>
            {categoryLabel}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {formatConfidence(sentence.confidence)}
          </span>
        </div>
        {sentence.modifiedAt && (
          <span className="text-[10px] text-zinc-600 font-mono">
            {sentence.modifiedAt.slice(11, 19)}
          </span>
        )}
      </div>
      {content}
    </div>
  );
}

export default function TaskDetailDrawer() {
  const navigate = useNavigate();

  const tasks = useTaskStore((s) => s.tasks);
  const detailDrawerOpen = useTaskStore((s) => s.detailDrawerOpen);
  const currentDetailTaskId = useTaskStore((s) => s.currentDetailTaskId);
  const closeDetailDrawer = useTaskStore((s) => s.closeDetailDrawer);
  const selectTask = useTaskStore((s) => s.selectTask);
  const retryWriteTask = useTaskStore((s) => s.retryWriteTask);

  const preferences = usePreferenceStore((s) => s.preferences);
  const sentences = useReportStore((s) => s.sentences);
  const currentTaskId = useReportStore((s) => s.currentTaskId);
  const loadSentencesForTask = useReportStore((s) => s.loadSentencesForTask);

  const task: ExamTask | undefined = useMemo(() => {
    if (!currentDetailTaskId) return undefined;
    return tasks.find((t) => t.taskId === currentDetailTaskId);
  }, [tasks, currentDetailTaskId]);

  const auditEvents = useMemo<AuditEvent[]>(() => {
    return task?.auditEvents ? [...task.auditEvents].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ) : [];
  }, [task]);

  const writeReceipt = task?.writeReceipt;
  const allReceipts = useMemo<PacsWriteReceipt[]>(() => {
    if (!writeReceipt) return [];
    const history = writeReceipt.historyReceipts ?? [];
    return [...history, writeReceipt];
  }, [writeReceipt]);

  const taskSentences = useMemo<SuggestionSentence[]>(() => {
    if (currentTaskId !== currentDetailTaskId) return [];
    return sentences.filter((s) => s.taskId === currentDetailTaskId);
  }, [sentences, currentTaskId, currentDetailTaskId]);

  useEffect(() => {
    if (detailDrawerOpen && currentDetailTaskId && currentTaskId !== currentDetailTaskId) {
      loadSentencesForTask(currentDetailTaskId);
    }
  }, [detailDrawerOpen, currentDetailTaskId, currentTaskId, loadSentencesForTask]);

  if (!task) return null;

  const sla = formatSlaRemaining(task.slaDeadline, preferences.slaWarnThresholdHours, preferences.slaDangerThresholdHours);
  const slaColor = sla.level === 'danger' ? 'text-red-400' : sla.level === 'warn' ? 'text-yellow-400' : 'text-green-400';
  const confidencePct = Math.round(task.aiConfidence * 100);
  const confidenceColor = task.aiConfidence >= 0.85 ? 'bg-green-500' : task.aiConfidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';

  const goToCompare = () => {
    selectTask(task.taskId);
    closeDetailDrawer();
    navigate('/compare');
  };

  return (
    <div className={cn('fixed inset-0 z-50', detailDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          detailDrawerOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={closeDetailDrawer}
      />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full w-[480px] max-w-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col transition-transform duration-200 ease-out',
          detailDrawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="bg-zinc-800/80 border-b border-zinc-700 p-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
              <h2 className="text-sm font-medium text-zinc-200">任务详情</h2>
              <span className="text-lg font-bold text-zinc-100 truncate">{task.patient.name}</span>
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-mono font-semibold border shrink-0',
                  EXAM_TYPE_BADGE[task.examType],
                )}
              >
                {task.examType}
              </span>
            </div>
            <button
              type="button"
              onClick={closeDetailDrawer}
              className="w-7 h-7 rounded-sm flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-5">
          <section className="card-base p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div className="col-span-2 border-b border-zinc-800 pb-1.5 mb-0.5">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">患者信息</div>
              </div>
              <div>
                <div className="text-zinc-500">ID</div>
                <div className="text-zinc-200 font-mono">{task.patient.id}</div>
              </div>
              <div>
                <div className="text-zinc-500">姓名</div>
                <div className="text-zinc-200 font-medium">{task.patient.name}</div>
              </div>
              <div>
                <div className="text-zinc-500">性别</div>
                <div className="text-zinc-200">{task.patient.gender === 'M' ? '男' : '女'}</div>
              </div>
              <div>
                <div className="text-zinc-500">年龄</div>
                <div className="text-zinc-200">{task.patient.age} 岁</div>
              </div>
              <div>
                <div className="text-zinc-500">床号</div>
                <div className="text-zinc-300">{task.patient.bedNo ?? '-'}</div>
              </div>
              <div>
                <div className="text-zinc-500">科室</div>
                <div className="text-zinc-300 truncate">{task.patient.department ?? '-'}</div>
              </div>

              <div className="col-span-2 border-b border-zinc-800 pb-1.5 mt-2 mb-0.5">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">检查信息</div>
              </div>
              <div>
                <div className="text-zinc-500">类型 / 部位</div>
                <div className="text-zinc-200">
                  <span className="mr-1 text-zinc-500">{task.examType}</span>
                  {task.examPart}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">检查时间</div>
                <div className="text-zinc-300 font-mono text-[11px]">{formatDateTime(task.examTime)}</div>
              </div>
              <div>
                <div className="text-zinc-500">接收时间</div>
                <div className="text-zinc-300 font-mono text-[11px]">{formatDateTime(task.receiveTime)}</div>
              </div>
              <div>
                <div className="text-zinc-500">AI置信度</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm overflow-hidden max-w-[60px]">
                    <div className={cn('h-full', confidenceColor)} style={{ width: `${confidencePct}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-zinc-300">{confidencePct}%</span>
                </div>
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5">优先级</div>
                <PriorityBadge priority={task.priority} />
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5">SLA剩余</div>
                <div className={cn('inline-flex items-center gap-1 font-mono text-[11px]', slaColor)}>
                  <Clock className="w-3 h-3" />
                  {sla.text}
                </div>
              </div>
            </div>
          </section>

          <section className="card-base p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                PACS 写入历史
              </h3>
              <span className="text-[11px] text-zinc-500">共 {allReceipts.length} 次</span>
            </div>

            {allReceipts.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-sm">
                未发起 PACS 写入
              </div>
            ) : (
              <div className="space-y-0">
                {allReceipts.map((r, idx) => {
                  const isLast = idx === allReceipts.length - 1;
                  const duration = r.startedAt && r.completedAt
                    ? Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
                    : null;
                  return (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <WriteTimelineIcon status={r.status} />
                        {!isLast && <div className="flex-1 w-px bg-zinc-800 my-1" />}
                      </div>
                      <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-zinc-200">第 {idx + 1} 次写入</span>
                          <WriteStatusBadge status={r.status} />
                          <span className="text-[10px] text-zinc-500 font-mono tabular-nums ml-auto">
                            {r.startedAt ? r.startedAt.slice(11, 19) : '-'}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[11px] space-y-0.5 text-zinc-500">
                          <div className="flex items-center gap-2">
                            <span>进度</span>
                            <div className="flex-1 h-1 bg-zinc-800 rounded-sm overflow-hidden max-w-[100px]">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  r.status === 'success' ? 'bg-green-500' :
                                  r.status === 'failed' ? 'bg-red-500' : 'bg-blue-500',
                                )}
                                style={{ width: `${r.progress}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-zinc-400 w-9">{r.progress}%</span>
                          </div>
                          {r.message && <div className="text-zinc-400">{r.message}</div>}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5">
                            {r.requestId && (
                              <span>请求ID: <span className="font-mono text-green-400">{r.requestId}</span></span>
                            )}
                            {duration !== null && (
                              <span>耗时: <span className="font-mono text-zinc-300">{duration}s</span></span>
                            )}
                            {r.retryCount > 0 && (
                              <span>重试: <span className="text-orange-400">{r.retryCount} 次</span></span>
                            )}
                            {r.status === 'failed' && r.message && (
                              <span className="text-red-400">原因: {r.message}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card-base p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-medical-500" />
                审计时间线
              </h3>
              <span className="text-[11px] text-zinc-500">{auditEvents.length} 条记录</span>
            </div>

            {auditEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-sm">
                暂无审计记录，开始审核后自动生成
              </div>
            ) : (
              <div>
                {auditEvents.map((evt, idx) => (
                  <AuditEventItem
                    key={evt.id}
                    event={evt}
                    isLast={idx === auditEvents.length - 1}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card-base p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                语句修改痕迹
              </h3>
              <span className="text-[11px] text-zinc-500">{taskSentences.length} 条</span>
            </div>

            {taskSentences.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-sm">
                加载语句数据中...
              </div>
            ) : (
              <div className="space-y-2">
                {taskSentences.map((s) => (
                  <SentenceItem key={s.id} sentence={s} />
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 bg-zinc-900/90 backdrop-blur border-t border-zinc-800 p-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToCompare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              转到影像对照
            </button>
            <button
              type="button"
              onClick={() => retryWriteTask(task.taskId)}
              disabled={task.writeStatus !== 'failed'}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-medium border transition-colors',
                task.writeStatus === 'failed'
                  ? 'bg-red-900/40 text-red-300 border-red-800/60 hover:bg-red-800/50 hover:border-red-700'
                  : 'bg-zinc-800/40 text-zinc-600 border-zinc-800 cursor-not-allowed',
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重试写入
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
