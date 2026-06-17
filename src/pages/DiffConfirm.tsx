import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Pencil,
  ArrowLeft,
  Save,
  FileCheck2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { useTaskStore } from '@/stores/useTaskStore';
import { useReportStore } from '@/stores/useReportStore';
import { useBatchStore } from '@/stores/useBatchStore';
import type {
  SuggestionSentence,
  SentenceDecision,
  ExamTask,
  RejectTemplate,
} from '@/types';
import { cn, formatDateTime } from '@/utils';

type CategoryTab = 'all' | 'finding' | 'impression' | 'measurement';

const CATEGORY_LABELS: Record<CategoryTab, string> = {
  all: '全部',
  finding: '发现',
  impression: '印象',
  measurement: '测量',
};

const CATEGORY_BADGE_LABELS: Record<'finding' | 'impression' | 'measurement', string> = {
  finding: '发现',
  impression: '印象',
  measurement: '测量',
};

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.8) return 'medium';
  return 'low';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  const config = {
    high: {
      label: '高',
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    medium: {
      label: '中',
      className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    low: {
      label: '低',
      className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    },
  }[level];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[36px] h-5 px-1.5 rounded-sm border text-[11px] font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: 'finding' | 'impression' | 'measurement' }) {
  const config = {
    finding: 'bg-medical-500/15 text-medical-400 border-medical-500/30',
    impression: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    measurement: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  }[category];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-5 px-2 rounded-sm border text-[11px] font-medium',
        config
      )}
    >
      {CATEGORY_BADGE_LABELS[category]}
    </span>
  );
}

interface SentenceContentProps {
  sentence: SuggestionSentence;
}

function SentenceContent({ sentence }: SentenceContentProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const lastRevision = sentence.revisionHistory?.[sentence.revisionHistory.length - 1];

  if (sentence.decision === 'remove') {
    return (
      <div
        className="relative group cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <p className="revision-delete text-sm leading-relaxed break-all">
          {sentence.content}
        </p>
        {showTooltip && lastRevision && (
          <RevisionTooltip revision={lastRevision} />
        )}
      </div>
    );
  }

  if (sentence.decision === 'edit' && sentence.editedContent) {
    return (
      <div
        className="relative group cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <p className="text-sm leading-relaxed break-all">
          <span className="revision-delete mr-1">{sentence.content}</span>
          <ChevronDown className="inline w-3 h-3 text-zinc-500 mx-0.5 -translate-y-0.5" />
          <span className="revision-insert ml-1">{sentence.editedContent}</span>
        </p>
        {showTooltip && lastRevision && (
          <RevisionTooltip revision={lastRevision} />
        )}
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-zinc-200 break-all">
      {sentence.content}
    </p>
  );
}

function RevisionTooltip({ revision }: { revision: { operator: string; timestamp: string } }) {
  return (
    <div className="absolute left-0 top-full mt-1 z-50 px-3 py-2 rounded-sm bg-zinc-800 border border-zinc-700 shadow-lg text-xs text-zinc-300 whitespace-nowrap animate-fade-in-up">
      <div>
        <span className="text-zinc-500">修改者：</span>
        <span className="text-zinc-200">{revision.operator}</span>
      </div>
      <div>
        <span className="text-zinc-500">修改时间：</span>
        <span className="text-zinc-200 font-mono tabular-nums">
          {formatTimestamp(revision.timestamp)}
        </span>
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  sentence: SuggestionSentence;
  editingId: string | null;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDecision: (decision: SentenceDecision) => void;
  onShortcutRef?: (el: HTMLDivElement | null) => void;
}

function SuggestionCard({
  sentence,
  editingId,
  editValue,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDecision,
  onShortcutRef,
}: SuggestionCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = editingId === sentence.id;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const decisionBorder = {
    keep: 'border-review-pass/60 bg-review-pass/10',
    remove: 'border-review-reject/60 bg-review-reject/10',
    edit: 'border-review-ai/60 bg-review-ai/10',
  }[sentence.decision];

  return (
    <div
      ref={onShortcutRef}
      data-sentence-id={sentence.id}
      className={cn(
        'group relative rounded-sm border transition-all duration-150',
        'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/60',
        sentence.decision !== 'keep' && decisionBorder
      )}
    >
      <div className="flex gap-3 p-3">
        <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
          <ConfidenceBadge confidence={sentence.confidence} />
          <CategoryBadge category={sentence.category} />
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div>
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onEditSave();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onEditCancel();
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-sm resize-none text-sm leading-relaxed',
                  'bg-zinc-950/80 border border-medical-500/40 text-zinc-100',
                  'focus:outline-none focus:border-medical-500 focus:ring-1 focus:ring-medical-500/30'
                )}
                rows={3}
              />
              <div className="flex gap-2 mt-2 text-xs text-zinc-500">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">Enter</span>
                <span>保存</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono ml-2">ESC</span>
                <span>取消</span>
              </div>
            </div>
          ) : (
            <SentenceContent sentence={sentence} />
          )}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onDecision('keep')}
            className={cn(
              'w-8 h-8 rounded-sm border flex items-center justify-center transition-all',
              sentence.decision === 'keep'
                ? 'bg-review-pass/20 border-review-pass/60 text-review-pass'
                : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-review-pass/50 hover:text-review-pass hover:bg-review-pass/10'
            )}
            title="保留 (1)"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDecision('remove')}
            className={cn(
              'w-8 h-8 rounded-sm border flex items-center justify-center transition-all',
              sentence.decision === 'remove'
                ? 'bg-review-reject/20 border-review-reject/60 text-review-reject'
                : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-review-reject/50 hover:text-review-reject hover:bg-review-reject/10'
            )}
            title="删除 (2)"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={onStartEdit}
            className={cn(
              'w-8 h-8 rounded-sm border flex items-center justify-center transition-all',
              sentence.decision === 'edit'
                ? 'bg-review-ai/20 border-review-ai/60 text-review-ai'
                : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-review-ai/50 hover:text-review-ai hover:bg-review-ai/10'
            )}
            title="修改 (3)"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportPreviewProps {
  task: ExamTask;
  sentences: SuggestionSentence[];
}

function ReportPreview({ task, sentences }: ReportPreviewProps) {
  const findings = sentences.filter(
    (s) => s.category === 'finding' && s.decision !== 'remove'
  );
  const measurements = sentences.filter(
    (s) => s.category === 'measurement' && s.decision !== 'remove'
  );
  const impressions = sentences.filter(
    (s) => s.category === 'impression' && s.decision !== 'remove'
  );

  const getText = (s: SuggestionSentence) =>
    s.decision === 'edit' && s.editedContent ? s.editedContent : s.content;

  const keepCount = sentences.filter((s) => s.decision === 'keep').length;
  const removeCount = sentences.filter((s) => s.decision === 'remove').length;
  const editCount = sentences.filter((s) => s.decision === 'edit').length;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between shrink-0 px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <FileCheck2 className="w-4 h-4 text-review-ai" />
          <span className="font-medium">最终报告预览</span>
          <span className="text-zinc-500">· 修订留痕已自动保存</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500">语句统计：</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-review-pass" />
            <span className="text-review-pass">保留 {keepCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-review-reject" />
            <span className="text-review-reject">删除 {removeCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-review-ai" />
            <span className="text-review-ai">修改 {editCount}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        <div className="bg-zinc-50 text-zinc-900 rounded-sm p-6 min-h-full shadow-sm">
          <div className="mb-5 pb-4 border-b border-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900 mb-3">
              {task.examType} {task.examPart}检查报告
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div>
                <span className="text-zinc-500">患者姓名：</span>
                <span className="text-zinc-900 font-medium">{task.patient.name}</span>
              </div>
              <div>
                <span className="text-zinc-500">患者ID：</span>
                <span className="text-zinc-900 font-mono">{task.patient.id}</span>
              </div>
              <div>
                <span className="text-zinc-500">性别：</span>
                <span className="text-zinc-900">
                  {task.patient.gender === 'M' ? '男' : '女'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">年龄：</span>
                <span className="text-zinc-900">{task.patient.age}岁</span>
              </div>
              {task.patient.bedNo && (
                <div>
                  <span className="text-zinc-500">床号：</span>
                  <span className="text-zinc-900">{task.patient.bedNo}</span>
                </div>
              )}
              {task.patient.department && (
                <div>
                  <span className="text-zinc-500">科室：</span>
                  <span className="text-zinc-900">{task.patient.department}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">检查类型：</span>
                <span className="text-zinc-900">{task.examType}</span>
              </div>
              <div>
                <span className="text-zinc-500">检查部位：</span>
                <span className="text-zinc-900">{task.examPart}</span>
              </div>
              <div>
                <span className="text-zinc-500">检查时间：</span>
                <span className="text-zinc-900 font-mono">
                  {formatTimestamp(task.examTime)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">任务编号：</span>
                <span className="text-zinc-900 font-mono">{task.taskId}</span>
              </div>
            </div>
          </div>

          {findings.length > 0 && (
            <section className="mb-5">
              <h3 className="text-base font-semibold text-zinc-900 mb-2">【影像所见】</h3>
              <div className="space-y-1.5 text-sm leading-7 text-zinc-800 pl-2">
                {findings.map((s) => (
                  <p key={s.id}>{getText(s)}</p>
                ))}
              </div>
            </section>
          )}

          {measurements.length > 0 && (
            <section className="mb-5">
              <h3 className="text-base font-semibold text-zinc-900 mb-2">【影像测量】</h3>
              <div className="space-y-1.5 text-sm leading-7 text-zinc-800 pl-2">
                {measurements.map((s) => (
                  <p key={s.id}>{getText(s)}</p>
                ))}
              </div>
            </section>
          )}

          {impressions.length > 0 && (
            <section className="mb-5">
              <h3 className="text-base font-semibold text-zinc-900 mb-2">【印象与建议】</h3>
              <div className="space-y-1.5 text-sm leading-7 text-zinc-800 pl-2">
                {impressions.map((s) => (
                  <p key={s.id}>{getText(s)}</p>
                ))}
              </div>
            </section>
          )}

          {findings.length === 0 && measurements.length === 0 && impressions.length === 0 && (
            <div className="py-12 text-center text-zinc-400 text-sm">
              暂无有效报告内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RejectModalProps {
  open: boolean;
  templates: RejectTemplate[];
  selectedId: string | null;
  customNote: string;
  onSelect: (id: string) => void;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function RejectModal({
  open,
  templates,
  selectedId,
  customNote,
  onSelect,
  onNoteChange,
  onConfirm,
  onCancel,
}: RejectModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-2xl rounded-sm bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-review-reject" />
            <h3 className="text-base font-semibold text-zinc-100">选择驳回原因</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-sm flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-auto scrollbar-thin">
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl.id)}
                className={cn(
                  'text-left p-3 rounded-sm border transition-all',
                  selectedId === tpl.id
                    ? 'bg-review-reject/10 border-review-reject/50'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'px-1.5 h-4 inline-flex items-center rounded-sm text-[10px] font-mono',
                        tpl.isDefault
                          ? 'bg-zinc-700/80 text-zinc-300'
                          : 'bg-violet-500/20 text-violet-400'
                      )}
                    >
                      {tpl.code}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        selectedId === tpl.id ? 'text-review-reject' : 'text-zinc-100'
                      )}
                    >
                      {tpl.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {tpl.usageCount}次
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {tpl.description}
                </p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              补充说明（可选）
            </label>
            <textarea
              value={customNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="请输入其他需要说明的驳回原因..."
              className={cn(
                'w-full px-3 py-2 rounded-sm resize-none text-sm',
                'bg-zinc-950/80 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600',
                'focus:outline-none focus:border-review-reject/60 focus:ring-1 focus:ring-review-reject/20'
              )}
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/50">
          <button onClick={onCancel} className="btn-ghost text-sm">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!selectedId}
            className={cn(
              'btn-danger text-sm',
              !selectedId && 'opacity-50 cursor-not-allowed'
            )}
          >
            确认驳回
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiffConfirm() {
  const navigate = useNavigate();
  const { tasks, selectedTaskId, passTask, rejectTask, startWriteTask, updateWriteProgress, completeWriteTask, failWriteTask } = useTaskStore();
  const {
    sentences,
    currentTaskId,
    loadSentencesForTask,
    updateSentenceDecision,
    editSentenceContent,
    saveDraft,
  } = useReportStore();
  const { rejectTemplates } = useBatchStore();

  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [splitRatio, setSplitRatio] = useState(2 / 3);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('');

  const selectedTask = useMemo<ExamTask | undefined>(
    () => tasks.find((t) => t.taskId === selectedTaskId),
    [tasks, selectedTaskId]
  );

  useEffect(() => {
    if (selectedTaskId && currentTaskId !== selectedTaskId) {
      loadSentencesForTask(selectedTaskId);
    }
  }, [selectedTaskId, currentTaskId, loadSentencesForTask]);

  const filteredSentences = useMemo(() => {
    if (activeTab === 'all') return sentences;
    return sentences.filter((s) => s.category === activeTab);
  }, [sentences, activeTab]);

  const unhandledCounts = useMemo(() => {
    const count = (cat: CategoryTab) => {
      const list = cat === 'all' ? sentences : sentences.filter((s) => s.category === cat);
      return list.filter((s) => s.decision === 'keep' && !s.modifiedAt).length;
    };
    return {
      all: count('all'),
      finding: count('finding'),
      impression: count('impression'),
      measurement: count('measurement'),
    };
  }, [sentences]);

  const handleDecision = (sentenceId: string, decision: SentenceDecision) => {
    if (editingId === sentenceId) {
      setEditingId(null);
    }
    updateSentenceDecision(sentenceId, decision);
  };

  const handleStartEdit = (sentence: SuggestionSentence) => {
    setEditingId(sentence.id);
    setEditValue(sentence.editedContent ?? sentence.content);
  };

  const handleEditSave = () => {
    if (editingId) {
      editSentenceContent(editingId, editValue.trim());
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const cards = document.querySelectorAll<HTMLDivElement>('[data-sentence-id]');
      if (cards.length === 0) return;

      let cardIndex = -1;
      const hovered = document.querySelector(
        '[data-sentence-id]:hover'
      ) as HTMLDivElement | null;

      if (hovered) {
        cardIndex = Array.from(cards).indexOf(hovered);
      }

      if (cardIndex < 0) return;
      const sid = cards[cardIndex].dataset.sentenceId;
      if (!sid) return;

      if (e.key === '1') {
        e.preventDefault();
        handleDecision(sid, 'keep');
      } else if (e.key === '2') {
        e.preventDefault();
        handleDecision(sid, 'remove');
      } else if (e.key === '3') {
        e.preventDefault();
        const s = sentences.find((x) => x.id === sid);
        if (s) handleStartEdit(s);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, sentences]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const clamped = Math.min(Math.max(ratio, 0.25), 0.8);
    setSplitRatio(clamped);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const showToast = (text: string) => {
    setToastText(text);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleSaveDraft = () => {
    if (!selectedTask) return;
    const savedAt = saveDraft(selectedTask.taskId);
    const formatted = formatDateTime(savedAt).replace(' ', ' ') +
      ':' + String(new Date(savedAt).getSeconds()).padStart(2, '0');
    showToast(`草稿已保存 ${formatted}`);
  };

  const handleBackToCompare = () => {
    navigate('/compare');
  };

  const handlePassToPacs = () => {
    if (!selectedTask || !selectedTaskId) return;

    const tid = selectedTaskId;
    const startedAt = Date.now();
    startWriteTask(tid);

    setTimeout(() => {
      updateWriteProgress(tid, 25, '正在索引序列…');
    }, 1000);

    setTimeout(() => {
      updateWriteProgress(tid, 50, '正在结构化报告…');
    }, 2000);

    setTimeout(() => {
      updateWriteProgress(tid, 75, '正在写入归档…');
    }, 3000);

    setTimeout(() => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const isSuccess = Math.random() < 0.9;
      if (isSuccess) {
        const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        completeWriteTask(tid, requestId, durationSeconds);
      } else {
        failWriteTask(tid, 'PACS 连接超时，请检查网络后重试');
      }
    }, 4000);
  };

  const handleOpenRejectModal = () => {
    setSelectedRejectId(null);
    setRejectNote('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedTask && selectedRejectId) {
      rejectTask(selectedTask.taskId);
      setRejectModalOpen(false);
    }
  };

  if (!selectedTask || sentences.length === 0) {
    return (
      <div className="window-content flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/60 flex items-center justify-center">
            <FileCheck2 className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-zinc-300 mb-1">暂无可审核任务</h3>
          <p className="text-sm text-zinc-500">
            请先在「任务列表」中选择一个待审核任务
          </p>
        </div>
      </div>
    );
  }

  const tabs: CategoryTab[] = ['all', 'finding', 'impression', 'measurement'];

  return (
    <div className="window-content p-0 flex flex-col h-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 flex flex-col min-h-0"
      >
        <div
          className="flex flex-col min-h-0"
          style={{ flexBasis: `${splitRatio * 100}%`, flexShrink: 0 }}
        >
          <div className="flex items-center justify-between shrink-0 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'relative px-3.5 py-1.5 rounded-sm text-sm transition-all',
                    activeTab === tab
                      ? 'text-zinc-100 bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  )}
                >
                  {CATEGORY_LABELS[tab]}
                  {unhandledCounts[tab] > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-medium border border-amber-500/30">
                      {unhandledCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="text-xs text-zinc-500">
              共 {filteredSentences.length} 条语句 · 悬停后按 1/2/3 快速操作
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin p-3 space-y-2">
            {filteredSentences.map((s) => (
              <SuggestionCard
                key={s.id}
                sentence={s}
                editingId={editingId}
                editValue={editValue}
                onStartEdit={() => handleStartEdit(s)}
                onEditChange={setEditValue}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
                onDecision={(d) => handleDecision(s.id, d)}
              />
            ))}
          </div>
        </div>

        <div
          onMouseDown={handleSplitterMouseDown}
          className="shrink-0 h-1.5 bg-zinc-800 hover:bg-medical-600/60 cursor-row-resize transition-colors border-y border-zinc-900"
          title="拖拽调整大小"
        />

        <div className="flex-1 flex flex-col min-h-0" style={{ flexShrink: 0 }}>
          <ReportPreview task={selectedTask} sentences={sentences} />
        </div>
      </div>

      <div className="sticky bottom-0 shrink-0 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePassToPacs}
              className="px-6 py-2.5 rounded-sm bg-review-pass text-white border border-emerald-400/50 hover:bg-emerald-500 active:bg-emerald-700 transition-colors font-medium shadow-md shadow-review-pass/20"
            >
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4" />
                通过并写入 PACS
              </span>
            </button>
            <button
              onClick={handleOpenRejectModal}
              className="px-5 py-2.5 rounded-sm bg-review-reject text-white border border-red-400/50 hover:bg-red-500 active:bg-red-700 transition-colors font-medium"
            >
              <span className="inline-flex items-center gap-2">
                <X className="w-4 h-4" />
                驳回，退回标注
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button onClick={handleSaveDraft} className="btn-ghost text-sm inline-flex items-center gap-1.5">
              <Save className="w-4 h-4" />
              保存草稿
            </button>
            <button onClick={handleBackToCompare} className="btn-outline text-sm inline-flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              返回影像对照
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2.5 rounded-sm border border-zinc-600 bg-zinc-800/95 text-zinc-100 text-sm shadow-xl backdrop-blur transition-all duration-300 z-50 ${
          toastVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {toastText}
      </div>

      <RejectModal
        open={rejectModalOpen}
        templates={rejectTemplates}
        selectedId={selectedRejectId}
        customNote={rejectNote}
        onSelect={setSelectedRejectId}
        onNoteChange={setRejectNote}
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectModalOpen(false)}
      />
    </div>
  );
}
