import { create } from 'zustand';
import type {
  SuggestionSentence,
  SentenceDecision,
  RevisionRecord,
} from '../types';
import { generateMockSuggestions } from '../mock/data';

const DRAFT_SENTENCES_KEY = 'radreview:draft-sentences';
const DRAFT_TASKS_KEY = 'radreview:drafts';

interface ReportState {
  sentences: SuggestionSentence[];
  currentTaskId: string | null;

  loadSentencesForTask: (taskId: string) => void;
  updateSentenceDecision: (sentenceId: string, decision: SentenceDecision) => void;
  editSentenceContent: (sentenceId: string, newContent: string) => void;
  getFinalReportText: () => string;
  saveDraft: (taskId: string) => string;
  hasDraft: (taskId: string) => boolean;
  clearDraft: (taskId: string) => void;
}

function generateRevisionId(): string {
  return `REV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRevision(
  action: 'insert' | 'delete' | 'replace',
  beforeText: string,
  afterText: string,
  operator: string = '当前用户'
): RevisionRecord {
  return {
    id: generateRevisionId(),
    action,
    beforeText,
    afterText,
    operator,
    timestamp: new Date().toISOString(),
  };
}

function loadDraftSentences(taskId: string): SuggestionSentence[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_SENTENCES_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, SuggestionSentence[]>;
    return all[taskId] ?? null;
  } catch (_e) {
    return null;
  }
}

function persistDraftSentences(taskId: string, sentences: SuggestionSentence[]): void {
  try {
    const raw = localStorage.getItem(DRAFT_SENTENCES_KEY);
    const all: Record<string, SuggestionSentence[]> = raw ? JSON.parse(raw) : {};
    all[taskId] = sentences;
    localStorage.setItem(DRAFT_SENTENCES_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

function markTaskHasDraft(taskId: string, savedAt: string): void {
  try {
    const raw = localStorage.getItem(DRAFT_TASKS_KEY);
    const all: Record<string, { savedAt: string }> = raw ? JSON.parse(raw) : {};
    all[taskId] = { savedAt };
    localStorage.setItem(DRAFT_TASKS_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

function unmarkTaskHasDraft(taskId: string): void {
  try {
    const raw = localStorage.getItem(DRAFT_TASKS_KEY);
    if (!raw) return;
    const all: Record<string, { savedAt: string }> = JSON.parse(raw);
    delete all[taskId];
    localStorage.setItem(DRAFT_TASKS_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

function removeDraftSentences(taskId: string): void {
  try {
    const raw = localStorage.getItem(DRAFT_SENTENCES_KEY);
    if (!raw) return;
    const all: Record<string, SuggestionSentence[]> = JSON.parse(raw);
    delete all[taskId];
    localStorage.setItem(DRAFT_SENTENCES_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

function saveDraftToStorage(taskId: string, sentences: SuggestionSentence[]): string {
  persistDraftSentences(taskId, sentences);
  const savedAt = new Date().toISOString();
  markTaskHasDraft(taskId, savedAt);
  return savedAt;
}

function syncTaskDraftStatus(taskId: string, savedAt: string): void {
  try {
    const { useTaskStore } = require('./useTaskStore');
    useTaskStore.getState().setTaskHasDraft(taskId, savedAt);
  } catch (_e) {
    // ignore
  }
}

function recordSentenceAuditEvent(
  taskId: string,
  event: {
    type: 'sentence-decision-changed' | 'sentence-edited' | 'draft-saved';
    summary: string;
    details?: Record<string, unknown>;
  }
): void {
  try {
    const { useTaskStore } = require('./useTaskStore');
    useTaskStore.getState().recordAuditEvent(taskId, event);
  } catch (_e) {
    // ignore
  }
}

export const useReportStore = create<ReportState>((set, get) => ({
  sentences: [],
  currentTaskId: null,

  loadSentencesForTask: (taskId) => {
    const draft = loadDraftSentences(taskId);
    const sentences = draft ?? generateMockSuggestions(taskId);
    set({ sentences, currentTaskId: taskId });
  },

  updateSentenceDecision: (sentenceId, decision) => {
    let changedSentence: SuggestionSentence | null = null;
    let oldDecision: SentenceDecision | null = null;

    set((state) => {
      const updatedSentences = state.sentences.map((s) => {
        if (s.id !== sentenceId) return s;

        const previousDecision = s.decision;
        const previousContent = s.editedContent ?? s.content;
        oldDecision = previousDecision;

        const revisionHistory = [...(s.revisionHistory ?? [])];

        if (previousDecision === 'edit' && s.editedContent) {
          if (decision === 'keep') {
            revisionHistory.push(
              createRevision('replace', s.content, s.editedContent)
            );
          } else if (decision === 'remove') {
            revisionHistory.push(
              createRevision('delete', s.editedContent, '')
            );
          }
        } else {
          if (decision === 'remove' && previousDecision !== 'remove') {
            revisionHistory.push(
              createRevision('delete', previousContent, '')
            );
          } else if (decision === 'keep' && previousDecision === 'remove') {
            revisionHistory.push(
              createRevision('insert', '', previousContent)
            );
          }
        }

        const updated = {
          ...s,
          decision,
          modifiedAt: new Date().toISOString(),
          modifiedBy: '当前用户',
          revisionHistory,
        };
        changedSentence = updated;
        return updated;
      });

      if (state.currentTaskId) {
        const savedAt = saveDraftToStorage(state.currentTaskId, updatedSentences);
        syncTaskDraftStatus(state.currentTaskId, savedAt);
      }

      return { sentences: updatedSentences };
    });

    const { currentTaskId } = get();
    if (currentTaskId && changedSentence && oldDecision !== null && oldDecision !== decision) {
      recordSentenceAuditEvent(currentTaskId, {
        type: 'sentence-decision-changed',
        summary: `语句决策变更：${oldDecision} → ${decision}`,
        details: {
          sentenceId,
          oldDecision,
          newDecision: decision,
          content: changedSentence.editedContent ?? changedSentence.content,
        },
      });
    }
  },

  editSentenceContent: (sentenceId, newContent) => {
    let changedSentence: SuggestionSentence | null = null;
    let beforeText = '';
    let afterText = '';

    set((state) => {
      const updatedSentences = state.sentences.map((s) => {
        if (s.id !== sentenceId) return s;

        beforeText = s.editedContent ?? s.content;
        afterText = newContent;

        const revisionHistory = [...(s.revisionHistory ?? [])];

        if (beforeText !== afterText) {
          if (beforeText.length === 0) {
            revisionHistory.push(createRevision('insert', beforeText, afterText));
          } else if (afterText.length === 0) {
            revisionHistory.push(createRevision('delete', beforeText, afterText));
          } else {
            revisionHistory.push(createRevision('replace', beforeText, afterText));
          }
        }

        const updated = {
          ...s,
          decision: 'edit' as const,
          editedContent: newContent,
          modifiedAt: new Date().toISOString(),
          modifiedBy: '当前用户',
          revisionHistory,
        };
        changedSentence = updated;
        return updated;
      });

      if (state.currentTaskId) {
        const savedAt = saveDraftToStorage(state.currentTaskId, updatedSentences);
        syncTaskDraftStatus(state.currentTaskId, savedAt);
      }

      return { sentences: updatedSentences };
    });

    const { currentTaskId } = get();
    if (currentTaskId && changedSentence && beforeText !== afterText) {
      recordSentenceAuditEvent(currentTaskId, {
        type: 'sentence-edited',
        summary: '语句内容已编辑',
        details: {
          sentenceId,
          oldValue: beforeText,
          newValue: afterText,
        },
      });
    }
  },

  getFinalReportText: () => {
    const { sentences } = get();

    const findings: string[] = [];
    const measurements: string[] = [];
    const impressions: string[] = [];

    for (const s of sentences) {
      if (s.decision === 'remove') continue;

      const text = s.decision === 'edit' && s.editedContent ? s.editedContent : s.content;

      switch (s.category) {
        case 'finding':
          findings.push(text);
          break;
        case 'measurement':
          measurements.push(text);
          break;
        case 'impression':
          impressions.push(text);
          break;
      }
    }

    const sections: string[] = [];

    if (findings.length > 0) {
      sections.push('【影像所见】');
      sections.push(...findings);
      sections.push('');
    }

    if (measurements.length > 0) {
      sections.push('【测量值】');
      sections.push(...measurements);
      sections.push('');
    }

    if (impressions.length > 0) {
      sections.push('【印象与建议】');
      sections.push(...impressions);
      sections.push('');
    }

    return sections.join('\n').trim();
  },

  saveDraft: (taskId) => {
    const { sentences } = get();
    const savedAt = saveDraftToStorage(taskId, sentences);
    syncTaskDraftStatus(taskId, savedAt);

    const keepCount = sentences.filter((s) => s.decision === 'keep').length;
    const removeCount = sentences.filter((s) => s.decision === 'remove').length;
    const editCount = sentences.filter((s) => s.decision === 'edit').length;

    recordSentenceAuditEvent(taskId, {
      type: 'draft-saved',
      summary: `保存草稿，共${sentences.length}条语句，其中保留${keepCount}/删除${removeCount}/修改${editCount}`,
      details: {
        savedAt,
        totalCount: sentences.length,
        keepCount,
        removeCount,
        editCount,
      },
    });

    return savedAt;
  },

  hasDraft: (taskId) => {
    try {
      const raw = localStorage.getItem(DRAFT_TASKS_KEY);
      if (!raw) return false;
      const all = JSON.parse(raw) as Record<string, { savedAt: string }>;
      return !!all[taskId];
    } catch (_e) {
      return false;
    }
  },

  clearDraft: (taskId) => {
    unmarkTaskHasDraft(taskId);
    removeDraftSentences(taskId);
    try {
      const { useTaskStore } = require('./useTaskStore');
      useTaskStore.getState().clearTaskHasDraft(taskId);
    } catch (_e) {
      // ignore
    }
    set((state) => {
      if (state.currentTaskId === taskId) {
        return { sentences: generateMockSuggestions(taskId) };
      }
      return {};
    });
  },
}));

export default useReportStore;
