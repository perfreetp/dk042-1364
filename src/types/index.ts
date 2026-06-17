export type ExamType = 'CT' | 'MR' | 'DR' | 'US' | 'DSA' | 'MG';

export type ReviewStatus = 'pending' | 'passed' | 'rejected' | 'timeout';

export type PriorityLevel = 'normal' | 'urgent' | 'emergency';

export interface PatientInfo {
  id: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  bedNo?: string;
  department?: string;
}

export interface ExamTask {
  taskId: string;
  patient: PatientInfo;
  examType: ExamType;
  examPart: string;
  examTime: string;
  receiveTime: string;
  aiConfidence: number;
  priority: PriorityLevel;
  status: ReviewStatus;
  slaDeadline: string;
  historyExamIds?: string[];
  lesionalCount: number;
  hasSignificantChange?: boolean;
}

export interface LesionMeasurement {
  id: string;
  taskId: string;
  name: string;
  location: string;
  diameter: number;
  volume?: number;
  huValue?: number;
  lastDiameter?: number;
  lastExamDate?: string;
  changeRate?: number;
  isSignificantChange: boolean;
  boundingBox: { x: number; y: number; w: number; h: number; slice: number };
  labelColor: string;
}

export type SentenceDecision = 'keep' | 'remove' | 'edit';

export interface SuggestionSentence {
  id: string;
  taskId: string;
  content: string;
  category: 'finding' | 'impression' | 'measurement';
  confidence: number;
  evidenceLesionIds: string[];
  decision: SentenceDecision;
  editedContent?: string;
  modifiedBy?: string;
  modifiedAt?: string;
  revisionHistory?: RevisionRecord[];
}

export interface RevisionRecord {
  id: string;
  action: 'insert' | 'delete' | 'replace';
  beforeText: string;
  afterText: string;
  operator: string;
  timestamp: string;
}

export interface RejectTemplate {
  id: string;
  code: string;
  title: string;
  description: string;
  isDefault: boolean;
  usageCount: number;
}

export interface PersonalStats {
  period: '7d' | '30d';
  totalReviewed: number;
  passedCount: number;
  rejectedCount: number;
  passRate: number;
  avgDurationSeconds: number;
  slaComplianceRate: number;
  dailyCounts: { date: string; count: number }[];
  rejectReasons: { reason: string; count: number; percent: number }[];
  byExamType: { examType: ExamType; count: number }[];
}

export interface UserPreferences {
  defaultSort: 'sla' | 'priority' | 'time' | 'confidence';
  defaultWindowMode: 'split' | 'overlay';
  slaWarnThresholdHours: number;
  slaDangerThresholdHours: number;
  significantChangeThreshold: number;
  enableShortcuts: boolean;
  rejectedTemplateFavorites: string[];
}

export type CompareMode = 'split' | 'overlay' | 'raw' | 'labeled';

export type SortBy = 'sla' | 'priority' | 'time' | 'confidence';
