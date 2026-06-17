import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  Clock,
  ScanLine,
  Brain,
  Stethoscope,
  Activity,
  Layers,
  Filter,
  SortAsc,
  RotateCcw,
} from 'lucide-react';
import { useTaskStore } from '@/stores/useTaskStore';
import { usePreferenceStore } from '@/stores/usePreferenceStore';
import { useSlaTimer } from '@/hooks/useSlaTimer';
import * as utils from '@/utils';
import type { ExamTask, ExamType, PriorityLevel, SortBy, PacsWriteStatus } from '@/types';

type ExamCategory = 'all' | 'CT' | 'MR' | 'DR' | 'US' | 'other';

interface ExamCategoryCard {
  key: ExamCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  types: ExamType[];
}

const EXAM_CATEGORIES: ExamCategoryCard[] = [
  { key: 'all', label: '全部', icon: Layers, types: ['CT', 'MR', 'DR', 'US', 'DSA', 'MG'] },
  { key: 'CT', label: 'CT', icon: ScanLine, types: ['CT'] },
  { key: 'MR', label: 'MR', icon: Brain, types: ['MR'] },
  { key: 'DR', label: 'DR', icon: Stethoscope, types: ['DR'] },
  { key: 'US', label: 'US', icon: Activity, types: ['US'] },
  { key: 'other', label: '其他', icon: Layers, types: ['DSA', 'MG'] },
];

const PRIORITY_OPTIONS: Array<{ value: 'all' | PriorityLevel; label: string }> = [
  { value: 'all', label: '全部优先级' },
  { value: 'emergency', label: '急诊' },
  { value: 'urgent', label: '加急' },
  { value: 'normal', label: '常规' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'today', label: '今天' },
  { value: '3d', label: '近3天' },
  { value: '7d', label: '近7天' },
] as const;

type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'sla', label: 'SLA剩余' },
  { value: 'priority', label: '优先级' },
  { value: 'time', label: '接收时间' },
  { value: 'confidence', label: 'AI置信度' },
];

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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  let barColor = 'bg-red-500';
  let textColor = 'text-red-400';
  if (value >= 0.85) {
    barColor = 'bg-green-500';
    textColor = 'text-green-400';
  } else if (value >= 0.7) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-400';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">置信度</span>
        <span className={`font-mono tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-sm bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SlaBadge({ task, warnHours, dangerHours }: {
  task: ExamTask;
  warnHours: number;
  dangerHours: number;
}) {
  const { text, level } = useSlaTimer(task.slaDeadline, warnHours, dangerHours);

  const base = 'inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-mono tabular-nums';

  if (level === 'safe') {
    return (
      <span className={`${base} bg-green-900/40 text-green-400 border border-green-800/60`}>
        <Clock className="w-3 h-3" />
        {text}
      </span>
    );
  }

  if (level === 'warn') {
    return (
      <span className={`${base} bg-yellow-900/40 text-yellow-400 border border-yellow-800/60`}>
        <Clock className="w-3 h-3" />
        {text}
      </span>
    );
  }

  return (
    <span className={`${base} bg-red-900/40 text-red-400 border border-red-800/60 animate-pulse animate-shake-x`}>
      <AlertTriangle className="w-3 h-3" />
      {text}
    </span>
  );
}

export default function TaskList() {
  const navigate = useNavigate();

  const tasks = useTaskStore((s) => s.tasks);
  const filterExamType = useTaskStore((s) => s.filterExamType);
  const sortBy = useTaskStore((s) => s.sortBy);
  const setFilter = useTaskStore((s) => s.setFilter);
  const setSort = useTaskStore((s) => s.setSort);
  const setSearch = useTaskStore((s) => s.setSearch);
  const selectTask = useTaskStore((s) => s.selectTask);
  const passTask = useTaskStore((s) => s.passTask);
  const rejectTask = useTaskStore((s) => s.rejectTask);
  const retryWriteTask = useTaskStore((s) => s.retryWriteTask);
  const getFilteredAndSortedTasks = useTaskStore((s) => s.getFilteredAndSortedTasks);

  const preferences = usePreferenceStore((s) => s.preferences);

  const [searchInput, setSearchInput] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('3d');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput, setSearch]);

  const getCategoryKey = useCallback((type: ExamType): ExamCategory => {
    if (type === 'DSA' || type === 'MG') return 'other';
    return type;
  }, []);

  const categoryStats = useMemo(() => {
    const now = new Date();
    const dangerMs = preferences.slaDangerThresholdHours * 60 * 60 * 1000;

    const stats: Record<ExamCategory, { total: number; timeout: number }> = {
      all: { total: 0, timeout: 0 },
      CT: { total: 0, timeout: 0 },
      MR: { total: 0, timeout: 0 },
      DR: { total: 0, timeout: 0 },
      US: { total: 0, timeout: 0 },
      other: { total: 0, timeout: 0 },
    };

    for (const task of tasks) {
      if (task.status === 'passed' || task.status === 'rejected') continue;
      const cat = getCategoryKey(task.examType);
      const isTimeout = now.getTime() - new Date(task.slaDeadline).getTime() > dangerMs
        || new Date(task.slaDeadline).getTime() < now.getTime();

      stats.all.total += 1;
      if (isTimeout) stats.all.timeout += 1;

      stats[cat].total += 1;
      if (isTimeout) stats[cat].timeout += 1;
    }

    return stats;
  }, [tasks, preferences.slaDangerThresholdHours, getCategoryKey]);

  const dangerCount = categoryStats.all.timeout;

  const filteredTasks = useMemo(() => {
    let list = getFilteredAndSortedTasks();

    list = list.filter((t) => t.status === 'pending' || t.status === 'timeout');

    if (priorityFilter !== 'all') {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const rangeMs: Record<DateRangeValue, number> = {
      today: 0,
      '3d': 2 * 24 * 60 * 60 * 1000,
      '7d': 6 * 24 * 60 * 60 * 1000,
    };
    const cutoff = todayStart - rangeMs[dateRange];
    list = list.filter((t) => new Date(t.examTime).getTime() >= cutoff);

    return list;
  }, [getFilteredAndSortedTasks, priorityFilter, dateRange]);

  const selectedCategory: ExamCategory = useMemo(() => {
    if (filterExamType === 'all') return 'all';
    return getCategoryKey(filterExamType);
  }, [filterExamType, getCategoryKey]);

  const handleCategoryClick = (category: ExamCategory) => {
    if (category === 'all') {
      setFilter('all');
    } else if (category === 'other') {
      setFilter('DSA');
    } else {
      setFilter(category as ExamType);
    }
  };

  const handleRowDoubleClick = (task: ExamTask) => {
    selectTask(task.taskId);
    navigate('/compare');
  };

  const toggleSelect = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.taskId)));
    }
  };

  return (
    <div className="window-content space-y-4">
      {dangerCount > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-sm bg-red-900/60 border border-red-600 text-red-200 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium">
            超2h未审: <span className="font-bold text-red-300">{dangerCount}</span> 例，请注意优先处理
          </span>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {EXAM_CATEGORIES.map(({ key, label, icon: Icon, types: _types }) => {
          const stat = categoryStats[key];
          const isActive = selectedCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleCategoryClick(key)}
              className={utils.cn(
                'card-base flex-1 min-w-[140px] px-4 py-3 text-left transition-all hover:bg-zinc-800/80',
                isActive && 'border-medical-500 bg-zinc-800/80 ring-1 ring-medical-500/40',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={utils.cn('w-4 h-4', isActive ? 'text-medical-400' : 'text-zinc-500')} />
                <span className={utils.cn('text-sm font-medium', isActive ? 'text-zinc-100' : 'text-zinc-300')}>
                  {label}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-zinc-100 font-mono tabular-nums">
                  {stat.total}
                </span>
                {stat.timeout > 0 && (
                  <span className="text-xs font-medium text-red-400 bg-red-900/40 px-1.5 py-0.5 rounded-sm">
                    超时 {stat.timeout}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card-base p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索患者姓名 / ID / 任务号"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-sm bg-zinc-800/60 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-medical-500 focus:ring-1 focus:ring-medical-500/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | PriorityLevel)}
              className="px-3 py-2 text-sm rounded-sm bg-zinc-800/60 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-medical-500 appearance-none pr-8 cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-sm bg-zinc-800/40 border border-zinc-700">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDateRange(opt.value)}
                className={utils.cn(
                  'px-3 py-1.5 text-xs rounded-sm transition-colors',
                  dateRange === opt.value
                    ? 'bg-medical-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSort(e.target.value as SortBy)}
              className="px-3 py-2 text-sm rounded-sm bg-zinc-800/60 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-medical-500 appearance-none pr-8 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <ChevronDown className="w-4 h-4 text-zinc-500 -ml-7 pointer-events-none" />
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="max-h-[calc(100vh-22rem)] overflow-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
              <tr className="text-zinc-400 text-xs">
                <th className="w-10 px-3 py-3 text-left font-medium">
                  <input
                    type="checkbox"
                    checked={filteredTasks.length > 0 && selectedIds.size === filteredTasks.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded-sm border-zinc-600 bg-zinc-800 text-medical-600 focus:ring-medical-500 focus:ring-offset-0 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium">患者信息</th>
                <th className="px-3 py-3 text-left font-medium">检查信息</th>
                <th className="px-3 py-3 text-left font-medium w-40">AI标签</th>
                <th className="px-3 py-3 text-left font-medium w-36">SLA倒计时</th>
                <th className="px-3 py-3 text-left font-medium w-20">优先级</th>
                <th className="px-3 py-3 text-left font-medium w-28">写入状态</th>
                <th className="px-3 py-3 text-right font-medium w-52">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredTasks.map((task) => {
                const isSelected = selectedIds.has(task.taskId);
                return (
                  <tr
                    key={task.taskId}
                    onDoubleClick={() => handleRowDoubleClick(task)}
                    className={utils.cn(
                      'h-[52px] transition-colors cursor-pointer',
                      isSelected ? 'bg-medical-900/20' : 'hover:bg-zinc-800/40',
                    )}
                  >
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(task.taskId)}
                        className="w-4 h-4 rounded-sm border-zinc-600 bg-zinc-800 text-medical-600 focus:ring-medical-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {task.hasDraft && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] bg-amber-900/50 text-amber-300 border border-amber-700/50 font-medium" title="有草稿">
                                🏷️ 草稿
                              </span>
                            )}
                            <span className="font-medium text-zinc-100">{task.patient.name}</span>
                            <span className="text-xs text-zinc-500 font-mono">{task.patient.id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                            <span>{task.patient.gender === 'M' ? '男' : '女'}</span>
                            <span>{task.patient.age}岁</span>
                            {task.patient.bedNo && (
                              <>
                                <span className="text-zinc-700">|</span>
                                <span className="text-zinc-400">{task.patient.bedNo}</span>
                              </>
                            )}
                            {task.patient.department && (
                              <>
                                <span className="text-zinc-700">|</span>
                                <span>{task.patient.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {task.examType}
                          </span>
                          <span className="text-zinc-200">{task.examPart}</span>
                          {task.hasSignificantChange && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-orange-900/40 text-orange-400 border border-orange-800/60">
                              有显著变化
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500 font-mono tabular-nums">
                          {utils.formatDateTime(task.examTime)}
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-zinc-500">病灶数</span>
                          <span className={utils.cn(
                            'font-mono tabular-nums font-medium',
                            task.lesionalCount === 0 ? 'text-zinc-400' :
                              task.lesionalCount >= 3 ? 'text-red-400' :
                                task.lesionalCount >= 1 ? 'text-yellow-400' : 'text-zinc-400',
                          )}>
                            {task.lesionalCount}
                          </span>
                        </div>
                        <ConfidenceBar value={task.aiConfidence} />
                      </div>
                    </td>
                    <td className="px-3">
                      <SlaBadge
                        task={task}
                        warnHours={preferences.slaWarnThresholdHours}
                        dangerHours={preferences.slaDangerThresholdHours}
                      />
                    </td>
                    <td className="px-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-3">
                      <WriteStatusCell
                        task={task}
                        onRetry={() => retryWriteTask(task.taskId)}
                      />
                    </td>
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => passTask(task.taskId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-800/40 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          通过
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectTask(task.taskId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-800/40 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          驳回
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRowDoubleClick(task)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-medical-900/30 text-medical-400 border border-medical-800/50 hover:bg-medical-800/40 transition-colors"
                        >
                          审核
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <Layers className="w-10 h-10 text-zinc-700" />
                      <span className="text-sm">暂无符合条件的待审任务</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface WriteStatusCellProps {
  task: ExamTask;
  onRetry: () => void;
}

function WriteStatusCell({ task, onRetry }: WriteStatusCellProps) {
  const writeStatus: PacsWriteStatus = task.writeStatus ?? 'idle';
  const progress = task.writeReceipt?.progress ?? 0;

  if (writeStatus === 'writing') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-blue-400 font-medium">
          写入中 {progress}%
        </span>
        <div className="w-12 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (writeStatus === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-green-900/40 text-green-400 border border-green-800/50 text-xs font-medium">
        <Check className="w-3 h-3" />
        已归档
      </span>
    );
  }

  if (writeStatus === 'failed') {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-red-900/40 text-red-400 border border-red-800/50 text-xs font-medium hover:bg-red-800/50 transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        重试
      </button>
    );
  }

  if (task.status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-green-900/30 text-green-500 border border-green-800/40 text-xs font-medium">
        已通过
      </span>
    );
  }

  if (task.status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-orange-900/30 text-orange-500 border border-orange-800/40 text-xs font-medium">
        已驳回
      </span>
    );
  }

  if (task.status === 'timeout') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-red-900/30 text-red-400 border border-red-800/40 text-xs font-medium">
        已超时
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-zinc-800/60 text-zinc-400 border border-zinc-700 text-xs font-medium">
      待审
    </span>
  );
}
