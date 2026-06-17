import { create } from 'zustand';
import type {
  SuggestionSentence,
  SentenceDecision,
  RevisionRecord,
} from '../types';
import { generateMockSuggestions } from '../mock/data';

interface ReportState {
  sentences: SuggestionSentence[];
  currentTaskId: string | null;

  loadSentencesForTask: (taskId: string) => void;
  updateSentenceDecision: (sentenceId: string, decision: SentenceDecision) => void;
  editSentenceContent: (sentenceId: string, newContent: string) => void;
  getFinalReportText: () => string;
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

export const useReportStore = create<ReportState>((set, get) => ({
  sentences: [],
  currentTaskId: null,

  loadSentencesForTask: (taskId) => {
    const sentences = generateMockSuggestions(taskId);
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
}));

export default useReportStore;
