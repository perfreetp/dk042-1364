import { create } from 'zustand';
import type {
  SuggestionSentence,
  SentenceDecision,
  RevisionRecord,
} from '../types';
import { generateMockSuggestions } from '../mock/data';
import { useTaskStore } from './useTaskStore';

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

export const useReportStore = create<ReportState>((set, get) => ({
  sentences: [],
  currentTaskId: null,

  loadSentencesForTask: (taskId) => {
    const draft = loadDraftSentences(taskId);
    const sentences = draft ?? generateMockSuggestions(taskId);
    set({ sentences, currentTaskId: taskId });
  },

  updateSentenceDecision: (sentenceId, decision) =>
    set((state) => ({
      sentences: state.sentences.map((s) => {
        if (s.id !== sentenceId) return s;

        const previousDecision = s.decision;
        const previousContent = s.editedContent ?? s.content;

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

        return {
          ...s,
          decision,
          modifiedAt: new Date().toISOString(),
          modifiedBy: '当前用户',
          revisionHistory,
        };
      }),
    })),

  editSentenceContent: (sentenceId, newContent) =>
    set((state) => ({
      sentences: state.sentences.map((s) => {
        if (s.id !== sentenceId) return s;

        const beforeText = s.editedContent ?? s.content;
        const afterText = newContent;

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

        return {
          ...s,
          decision: 'edit',
          editedContent: newContent,
          modifiedAt: new Date().toISOString(),
          modifiedBy: '当前用户',
          revisionHistory,
        };
      }),
    })),

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
    persistDraftSentences(taskId, sentences);
    const savedAt = new Date().toISOString();
    markTaskHasDraft(taskId, savedAt);
    useTaskStore.getState().setTaskHasDraft(taskId, savedAt);
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
}));

export default useReportStore;
