import { useState, useMemo } from 'react';
import {
  Check,
  X,
  Filter,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  User,
  Stethoscope,
  Shield,
  Clock,
  ChevronRight,
  ListTodo,
} from 'lucide-react';
import { useTaskStore } from '@/stores/useTaskStore';
import { useBatchStore, isInTimeRange } from '@/stores/useBatchStore';
import { usePreferenceStore } from '@/stores/usePreferenceStore';
import type { ExamTask, ExamType, RejectTemplate } from '@/types';
import { cn, formatConfidence, formatDateTime, formatSlaRemaining } from '@/utils';
import BatchRunDetailDrawer from '@/components/batch/BatchRunDetailDrawer';

const EXAM_TYPES: ExamType[] = ['CT', 'MR', 'DR', 'US', 'DSA', 'MG'];

const TIME_RANGES = [
  { value: 'today', label: '今天' },
  { value: '3d', label: '近3天' },
  { value: '7d', label: '近7天' },
  { value: 'all', label: '全部' },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]['value'];

export default function BatchProcess() {
  const tasks = useTaskStore((s) => s.tasks);
  const preferences = usePreferenceStore((s) => s.preferences);
  const taskStoreActions = useTaskStore((s) => ({
    startWriteTask: s.startWriteTask,
    updateWriteProgress: s.updateWriteProgress,
    completeWriteTask: s.completeWriteTask,
    failWriteTask: s.failWriteTask,
    showTopBanner: s.showTopBanner,
    clearTopBanner: s.clearTopBanner,
  }));
  const {
    selectedTaskIds,
    rejectTemplates,
    toggleTaskSelection,
    selectAllMatching,
    clearSelection,
    applyBatchPass,
    applyBatchReject,
    setBatchFilter,
    batchFilter,
    triggerBatchRun,
    openBatchDetailDrawer,
  } = useBatchStore();

  const [selectedExamTypes, setSelectedExamTypes] = useState<ExamType[]>(batchFilter.selectedExamTypes);
  const [minConfidence, setMinConfidence] = useState(batchFilter.minConfidence);
  const [noSignificantChange, setNoSignificantChange] = useState(batchFilter.noSignificantChange);
  const [onlyNormalPriority, setOnlyNormalPriority] = useState(batchFilter.onlyNormalPriority);
  const [timeRange, setTimeRange] = useState<TimeRange>(batchFilter.timeRange);

  const [showPassModal, setShowPassModal] = useState(false);
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    rejectTemplates.find((t) => t.isDefault)?.id ?? rejectTemplates[0]?.id ?? null,
  );
  const [customNote, setCustomNote] = useState('');
  const [lastUsedTemplateId, setLastUsedTemplateId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return useBatchStore.getState().getMatchingTasks();
  }, [
    tasks,
    selectedExamTypes,
    minConfidence,
    noSignificantChange,
    onlyNormalPriority,
    timeRange,
  ]);

  const totalPending = useMemo(
    () => tasks.filter((t) => t.status === 'pending').length,
    [tasks],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((t) => selectedTaskIds.includes(t.taskId)),
    [tasks, selectedTaskIds],
  );

  const groupedStats = useMemo(() => {
    const map = new Map<ExamType, number>();
    for (const t of selectedTasks) {
      map.set(t.examType, (map.get(t.examType) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [selectedTasks]);

  const handleToggleExamType = (type: ExamType) => {
    setSelectedExamTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      setBatchFilter({ selectedExamTypes: next });
      return next;
    });
  };

  const handleSelectAll = () => {
    const ids = filteredTasks.map((t) => t.taskId);
    for (const id of ids) {
      if (!selectedTaskIds.includes(id)) toggleTaskSelection(id);
    }
  };

  const handleInvertSelection = () => {
    const ids = filteredTasks.map((t) => t.taskId);
    for (const id of ids) {
      toggleTaskSelection(id);
    }
  };

  const handleBatchPassConfirm = () => {
    const ids = [...selectedTaskIds];
    setShowPassModal(false);
    triggerBatchRun(ids);
  };

  const handleBatchRejectConfirm = () => {
    if (!selectedTemplateId) return;
    applyBatchReject(selectedTemplateId);
    setLastUsedTemplateId(selectedTemplateId);
    setShowRejectPanel(false);
    setCustomNote('');
  };

  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.includes(t.taskId));

  const displayTemplate = lastUsedTemplateId
    ? rejectTemplates.find((t) => t.id === lastUsedTemplateId)
    : selectedTemplateId
      ? rejectTemplates.find((t) => t.id === selectedTemplateId)
      : null;

  return (
    <div className="window-content flex flex-col gap-4">
      {/* 顶部筛选面板 */}
      <div className="card-base p-4 shrink-0">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-4">
            {/* 检查类型多选 */}
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-1.5 text-sm text-zinc-400 w-24 shrink-0 pt-1.5">
                <Stethoscope className="w-4 h-4" />
                <span>检查类型</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAM_TYPES.map((type) => {
                  const active = selectedExamTypes.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleToggleExamType(type)}
                      className={cn(
                        'px-3 py-1.5 rounded-sm text-sm font-medium border transition-colors',
                        active
                          ? 'bg-medical-600 text-white border-medical-500'
                          : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800',
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
                {selectedExamTypes.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedExamTypes([]);
                      setBatchFilter({ selectedExamTypes: [] });
                    }}
                    className="px-2 py-1.5 rounded-sm text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* 置信度滑块 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-zinc-400 w-24 shrink-0">
                <Shield className="w-4 h-4" />
                <span>AI置信度</span>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm text-zinc-500">≥</span>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={minConfidence}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMinConfidence(val);
                    setBatchFilter({ minConfidence: val });
                  }}
                  className="flex-1 h-2 bg-zinc-800 rounded-sm appearance-none cursor-pointer accent-medical-500"
                />
                <span className="text-sm font-mono tabular-nums text-medical-400 w-12 text-right">
                  {Math.round(minConfidence * 100)}%
                </span>
              </div>
            </div>

            {/* 勾选框 */}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noSignificantChange}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setNoSignificantChange(val);
                    setBatchFilter({ noSignificantChange: val });
                  }}
                  className="w-4 h-4 rounded-sm accent-medical-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-sm text-zinc-300">仅显示无显著变化的任务</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyNormalPriority}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setOnlyNormalPriority(val);
                    setBatchFilter({ onlyNormalPriority: val });
                  }}
                  className="w-4 h-4 rounded-sm accent-medical-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-sm text-zinc-300">仅显示普通优先级</span>
              </label>
            </div>

            {/* 时间范围 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-zinc-400 w-24 shrink-0">
                <Clock className="w-4 h-4" />
                <span>检查时间</span>
              </div>
              <div className="relative">
                <select
                  value={timeRange}
                  onChange={(e) => {
                    const val = e.target.value as TimeRange;
                    setTimeRange(val);
                    setBatchFilter({ timeRange: val });
                  }}
                  className="appearance-none bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 pl-3 pr-8 py-1.5 rounded-sm focus:outline-none focus:border-medical-500 cursor-pointer"
                >
                  {TIME_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 右侧：一键匹配 + 统计 */}
          <div className="lg:w-60 flex lg:flex-col items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-4 lg:pt-0 lg:pl-4">
            <div className="flex-1 lg:flex-none w-full lg:w-auto">
              <div className="text-xs text-zinc-500 mb-1">匹配结果</div>
              <div className="text-lg font-semibold">
                <span className="text-medical-400">{filteredTasks.length}</span>
                <span className="text-zinc-500 mx-1">/</span>
                <span className="text-zinc-300">{totalPending}</span>
              </div>
              <div className="text-xs text-zinc-500">符合条件 / 待审总数</div>
            </div>
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <button
                onClick={selectAllMatching}
                disabled={filteredTasks.length === 0}
                className="btn-primary flex items-center gap-2 w-full lg:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                <span>一键匹配 {filteredTasks.length} 例</span>
              </button>
              {selectedTaskIds.length > 0 && (
                <button
                  onClick={openBatchDetailDrawer}
                  className="btn-ghost flex items-center gap-2 justify-center text-xs"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>批次详情</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 中部：任务表格 */}
      <div className="card-base flex-1 flex flex-col overflow-hidden">
        {/* 表头操作栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-300">待处理任务</span>
            <span className="text-xs text-zinc-500">
              ({filteredTasks.length} 条，已选 {selectedTasks.filter((t) => filteredTasks.includes(t)).length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className={cn(
                'px-3 py-1 rounded-sm text-xs border transition-colors',
                allFilteredSelected
                  ? 'bg-medical-600/20 text-medical-400 border-medical-600/50'
                  : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:border-zinc-600',
              )}
            >
              {allFilteredSelected ? '取消全选' : '全选'}
            </button>
            <button
              onClick={handleInvertSelection}
              className="px-3 py-1 rounded-sm text-xs bg-zinc-800/50 text-zinc-300 border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              反选
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 rounded-sm text-xs bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              清空
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
              <tr className="text-zinc-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 w-12 font-medium"></th>
                <th className="text-left px-4 py-3 font-medium">患者信息</th>
                <th className="text-left px-4 py-3 font-medium">检查信息</th>
                <th className="text-left px-4 py-3 font-medium w-28">AI置信度</th>
                <th className="text-left px-4 py-3 font-medium w-32">SLA</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-zinc-500">
                      <Filter className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm">暂无符合条件的任务</p>
                      <p className="text-xs text-zinc-600 mt-1">请调整筛选条件或稍后刷新</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <TaskRow
                    key={task.taskId}
                    task={task}
                    selected={selectedTaskIds.includes(task.taskId)}
                    onToggle={() => toggleTaskSelection(task.taskId)}
                    slaWarn={preferences.slaWarnThresholdHours}
                    slaDanger={preferences.slaDangerThresholdHours}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部操作条 */}
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => selectedTasks.length > 0 && setShowPassModal(true)}
              disabled={selectedTasks.length === 0}
              className="px-6 py-2.5 rounded-sm bg-review-pass text-white border border-emerald-500 hover:bg-emerald-500 active:bg-emerald-700 transition-colors text-base font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>批量通过</span>
            </button>
            <span className="text-sm text-zinc-400">
              将处理 <span className="text-emerald-400 font-semibold">{selectedTasks.length}</span> 例
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => selectedTasks.length > 0 && setShowRejectPanel(true)}
              disabled={selectedTasks.length === 0}
              className="px-6 py-2.5 rounded-sm bg-review-reject text-white border border-red-500 hover:bg-red-500 active:bg-red-700 transition-colors text-base font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              <span>批量驳回</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-80">
            <span className="text-xs text-zinc-500 shrink-0">驳回模板：</span>
            <button
              onClick={() => setShowRejectPanel(true)}
              className="flex-1 text-left px-3 py-2 rounded-sm bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors min-w-0"
            >
              {displayTemplate ? (
                <div className="truncate">
                  <div className="text-sm text-zinc-200 truncate">{displayTemplate.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{displayTemplate.code}</div>
                </div>
              ) : (
                <span className="text-sm text-zinc-500">未选择</span>
              )}
            </button>
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          </div>
        </div>
      </div>

      {/* 批量通过确认 Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPassModal(false)}
          />
          <div className="relative card-base w-full max-w-md mx-4 animate-fade-in-up">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-100">
                确认批量通过 {selectedTasks.length} 例回写任务？
              </h3>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <div className="text-sm text-zinc-400 mb-2">按检查类型统计：</div>
                <div className="space-y-1.5">
                  {groupedStats.length === 0 ? (
                    <div className="text-sm text-zinc-500">未选中任何任务</div>
                  ) : (
                    groupedStats.map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between py-1.5 px-3 rounded-sm bg-zinc-800/40"
                      >
                        <span className="text-sm text-zinc-300">{type}</span>
                        <span className="text-sm font-medium text-zinc-200">{count} 例</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-sm bg-zinc-800/40 border border-zinc-800">
                <AlertTriangle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  确认通过后将写入 PACS 正式库，操作不可撤销
                </p>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPassModal(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleBatchPassConfirm}
                className="px-5 py-2 rounded-sm bg-review-pass text-white border border-emerald-500 hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
              >
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回模板面板 */}
      {showRejectPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowRejectPanel(false)}
          />
          <div className="relative card-base w-full max-w-lg mx-4 animate-fade-in-up">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">
                批量驳回 {selectedTasks.length} 例任务
              </h3>
              <button
                onClick={() => setShowRejectPanel(false)}
                className="p-1 rounded-sm hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-auto scrollbar-thin space-y-3">
              <div className="text-sm text-zinc-400 mb-2">选择驳回模板：</div>
              <div className="space-y-2">
                {rejectTemplates.map((tpl) => (
                  <RejectTemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={selectedTemplateId === tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                  />
                ))}
              </div>
              <div className="mt-4">
                <div className="text-sm text-zinc-400 mb-2">附加说明（可选）：</div>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="请输入自定义驳回说明..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-sm bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectPanel(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleBatchRejectConfirm}
                disabled={!selectedTemplateId || selectedTasks.length === 0}
                className="px-5 py-2 rounded-sm bg-review-reject text-white border border-red-500 hover:bg-red-500 active:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      <BatchRunDetailDrawer />
    </div>
  );
}

interface TaskRowProps {
  task: ExamTask;
  selected: boolean;
  onToggle: () => void;
  slaWarn: number;
  slaDanger: number;
}

function TaskRow({ task, selected, onToggle, slaWarn, slaDanger }: TaskRowProps) {
  const sla = formatSlaRemaining(task.slaDeadline, slaWarn, slaDanger);
  const slaColor =
    sla.level === 'danger'
      ? 'text-red-400'
      : sla.level === 'warn'
        ? 'text-amber-400'
        : 'text-zinc-400';

  const priorityBadge = {
    emergency: 'bg-red-500/20 text-red-400 border-red-500/40',
    urgent: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    normal: 'bg-zinc-700/40 text-zinc-400 border-zinc-700',
  }[task.priority];

  const priorityLabel = {
    emergency: '急诊',
    urgent: '加急',
    normal: '普通',
  }[task.priority];

  const genderLabel = task.patient.gender === 'M' ? '男' : '女';

  return (
    <tr
      className={cn(
        'border-b border-zinc-800/60 transition-colors cursor-pointer',
        selected ? 'bg-medical-600/10' : 'hover:bg-zinc-800/30',
      )}
      onClick={onToggle}
    >
      <td className="px-4 py-3">
        <div
          className={cn(
            'w-5 h-5 rounded-sm border flex items-center justify-center transition-colors',
            selected
              ? 'bg-medical-600 border-medical-500'
              : 'border-zinc-700 hover:border-zinc-500',
          )}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{task.patient.name}</span>
              <span className="text-xs text-zinc-500">
                {genderLabel} · {task.patient.age}岁
              </span>
            </div>
            <div className="text-xs text-zinc-500 truncate mt-0.5">
              {task.patient.id}
              {task.patient.bedNo && <span className="ml-2">床号 {task.patient.bedNo}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-1.5 py-0.5 text-xs font-semibold rounded-sm',
              'bg-medical-600/20 text-medical-400 border border-medical-600/40',
            )}
          >
            {task.examType}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 text-xs rounded-sm border',
              priorityBadge,
            )}
          >
            {priorityLabel}
          </span>
        </div>
        <div className="text-sm text-zinc-300 mt-1">{task.examPart}</div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {formatDateTime(task.examTime)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm overflow-hidden max-w-[80px]">
            <div
              className={cn(
                'h-full rounded-sm transition-all',
                task.aiConfidence >= 0.9
                  ? 'bg-emerald-500'
                  : task.aiConfidence >= 0.75
                    ? 'bg-medical-500'
                    : 'bg-amber-500',
              )}
              style={{ width: `${task.aiConfidence * 100}%` }}
            />
          </div>
          <span
            className={cn(
              'text-sm font-mono tabular-nums',
              task.aiConfidence >= 0.9
                ? 'text-emerald-400'
                : task.aiConfidence >= 0.75
                  ? 'text-medical-400'
                  : 'text-amber-400',
            )}
          >
            {formatConfidence(task.aiConfidence)}
          </span>
        </div>
        {task.hasSignificantChange && (
          <div className="mt-1 text-xs text-review-diff">⚠ 有显著变化</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className={cn('text-sm font-mono tabular-nums', slaColor)}>
          {sla.text}
        </div>
        <div className="text-xs text-zinc-600 mt-0.5">
          {task.lesionalCount > 0 ? `${task.lesionalCount} 个病灶` : '无病灶'}
        </div>
      </td>
    </tr>
  );
}

interface RejectTemplateCardProps {
  template: RejectTemplate;
  selected: boolean;
  onClick: () => void;
}

function RejectTemplateCard({ template, selected, onClick }: RejectTemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-sm border transition-all',
        selected
          ? 'bg-red-500/10 border-red-500/60 ring-1 ring-red-500/30'
          : 'bg-zinc-800/40 border-zinc-700 hover:border-zinc-600',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {selected && <Check className="w-4 h-4 text-red-400 shrink-0" />}
            <span
              className={cn(
                'text-sm font-medium',
                selected ? 'text-red-300' : 'text-zinc-200',
              )}
            >
              {template.title}
            </span>
            <span className="text-xs text-zinc-500 font-mono">{template.code}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{template.description}</p>
        </div>
        <div className="text-xs text-zinc-600 shrink-0">
          使用 {template.usageCount} 次
        </div>
      </div>
    </button>
  );
}
