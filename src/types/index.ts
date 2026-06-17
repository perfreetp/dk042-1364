export type ExamType = 'CT' | 'MR' | 'DR' | 'US' | 'DSA' | 'MG';

export type ReviewStatus = 'pending' | 'passed' | 'rejected' | 'timeout';

export type PacsWriteStatus = 'idle' | 'queued' | 'writing' | 'success' | 'failed' | 'retry-wait';

export type PriorityLevel = 'normal' | 'urgent' | 'emergency';

export interface PatientInfo {
  id: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  bedNo?: string;
  department?: string;
}

export interface PacsWriteReceipt {
  status: PacsWriteStatus;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  message?: string;
  requestId?: string;
  retryCount: number;
  nextRetryAt?: string;
  historyReceipts?: Omit<PacsWriteReceipt, 'historyReceipts'>[];
}

export type AuditEventType =
  | 'task-selected'
  | 'draft-saved'
  | 'draft-loaded'
  | 'sentence-keep'
  | 'sentence-remove'
  | 'sentence-edited'
  | 'write-started'
  | 'write-progress'
  | 'write-success'
  | 'write-failed'
  | 'write-retried'
  | 'task-passed'
  | 'task-rejected';

export interface AuditEvent {
  id: string;
  taskId: string;
  type: AuditEventType;
  operator: string;
  timestamp: string;
  summary: string;
  details?: Record<string, unknown>;
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
  writeStatus?: PacsWriteStatus;
  writeReceipt?: PacsWriteReceipt;
  hasDraft?: boolean;
  lastDraftSavedAt?: string;
  auditEvents?: AuditEvent[];
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

export type TopBannerStatus = 'writing' | 'success' | 'failed';

export interface TopBannerReceipt {
  status: TopBannerStatus;
  taskId: string;
  patientName: string;
  progress?: number;
  message?: string;
  requestId?: string;
  durationSeconds?: number;
  retryCount?: number;
  isBatch?: boolean;
  batchSuccess?: number;
  batchFailed?: number;
}

export type BatchTimeRange = 'today' | '3d' | '7d' | 'all';

export type ExamCategory = 'all' | 'CT' | 'MR' | 'DR' | 'US' | 'other';

export interface BatchTaskRun {
  taskId: string;
  patientName: string;
  examType: ExamType;
  writeStatus: PacsWriteStatus;
  stage: string;
  progress: number;
  retryCount: number;
  requestId?: string;
  failReason?: string;
  durationSeconds?: number;
  completedAt?: string;
  startedAt?: string;
}

export interface BatchRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: 'running' | 'completed';
  taskRuns: BatchTaskRun[];
}

export const AUDIT_EVENT_TYPE_LABEL: Record<AuditEventType, string> = {
  'task-selected': '选中任务',
  'draft-saved': '保存草稿',
  'draft-loaded': '加载草稿',
  'sentence-keep': '保留语句',
  'sentence-remove': '删除语句',
  'sentence-edited': '修改语句',
  'write-started': '开始写入',
  'write-progress': '写入进度',
  'write-success': '写入成功',
  'write-failed': '写入失败',
  'write-retried': '重试写入',
  'task-passed': '审核通过',
  'task-rejected': '审核驳回',
};

export const AUDIT_EVENT_TYPE_COLOR: Record<AuditEventType, string> = {
  'task-selected': 'bg-zinc-500',
  'draft-saved': 'bg-cyan-500',
  'draft-loaded': 'bg-cyan-400',
  'sentence-keep': 'bg-emerald-500',
  'sentence-remove': 'bg-red-500',
  'sentence-edited': 'bg-amber-500',
  'write-started': 'bg-blue-500',
  'write-progress': 'bg-blue-400',
  'write-success': 'bg-green-500',
  'write-failed': 'bg-red-500',
  'write-retried': 'bg-yellow-500',
  'task-passed': 'bg-green-600',
  'task-rejected': 'bg-orange-600',
};

export const EXAM_TYPE_BADGE: Record<ExamType, string> = {
  CT: 'bg-blue-600/80 border-blue-500 text-blue-100',
  MR: 'bg-purple-600/80 border-purple-500 text-purple-100',
  DR: 'bg-emerald-600/80 border-emerald-500 text-emerald-100',
  US: 'bg-cyan-600/80 border-cyan-500 text-cyan-100',
  DSA: 'bg-orange-600/80 border-orange-500 text-orange-100',
  MG: 'bg-pink-600/80 border-pink-500 text-pink-100',
};
