import type {
  ExamTask,
  ExamType,
  LesionMeasurement,
  PersonalStats,
  PriorityLevel,
  RejectTemplate,
  ReviewStatus,
  SuggestionSentence,
  UserPreferences,
} from '@/types';

class SeededRandom {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number, decimals: number = 2): number {
    const val = this.next() * (max - min) + min;
    return Number(val.toFixed(decimals));
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

const EXAM_TYPES: ExamType[] = ['CT', 'MR', 'DR', 'US', 'DSA', 'MG'];

const EXAM_PARTS: Record<ExamType, string[]> = {
  CT: ['胸部', '腹部', '头颅', '颈椎', '腰椎', '盆腔'],
  MR: ['头颅', '腰椎', '膝关节', '肩关节', '肝脏', '盆腔'],
  DR: ['胸部正位', '胸部侧位', '腹部立位', '颈椎正侧位', '腰椎正侧位', '膝关节'],
  US: ['肝胆胰脾', '双肾输尿管', '甲状腺', '乳腺', '心脏彩超', '妇科'],
  DSA: ['冠脉造影', '脑血管造影', '下肢动脉', '肾动脉', '肺动脉', '主动脉'],
  MG: ['双侧乳腺轴位', '双侧乳腺斜位', '左侧乳腺', '右侧乳腺'],
};

const PATIENT_FIRST_NAMES_M = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '胡', '朱', '高'];
const PATIENT_FIRST_NAMES_F = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '胡', '朱', '高'];
const PATIENT_LAST_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平'];

const DEPARTMENTS = ['呼吸内科', '消化内科', '心血管内科', '神经内科', '肿瘤科', '骨科', '普外科', '神经外科', '泌尿外科', '妇产科', '儿科', '急诊科'];

const LESION_NAMES: Record<ExamType, string[]> = {
  CT: ['右肺上叶结节', '左肺下叶磨玻璃影', '肝右叶低密度灶', '肝左叶囊肿', '肾上腺结节', '腹膜后淋巴结肿大', '胆囊结石', '肾结石', '胰腺占位', '脾脏增大'],
  MR: ['颅内占位性病变', '腔隙性脑梗塞', '腰椎间盘突出', '膝关节半月板损伤', '肩关节肩袖损伤', '肝血管瘤', '子宫肌瘤', '前列腺增生', '脊髓空洞症', '三叉神经鞘瘤'],
  DR: ['肺部结节影', '肺纹理增粗', '心影增大', '肋骨骨折', '胸椎骨质增生', '腰突症', '肩关节脱位', '膝关节退行性变', '膈下游离气体', '肠梗阻征象'],
  US: ['肝囊肿', '肝血管瘤', '胆囊息肉', '胆囊结石', '甲状腺结节', '乳腺结节', '子宫肌瘤', '卵巢囊肿', '肾结石', '颈动脉斑块'],
  DSA: ['冠状动脉狭窄', '前降支闭塞', '脑血管动脉瘤', '下肢动脉闭塞', '肾动脉狭窄', '肺动脉栓塞', '主动脉夹层', '动静脉畸形', '锁骨下动脉狭窄', '椎动脉狭窄'],
  MG: ['乳腺纤维腺瘤', '乳腺囊肿', '乳腺增生结节', '乳腺钙化灶', '乳腺结构扭曲', '腋窝淋巴结肿大', '乳头后方占位', '胸壁侵犯征象'],
};

const LESION_LOCATIONS = ['右肺上叶前段', '右肺中叶', '右肺下叶背段', '左肺上叶尖后段', '左肺下叶基底段',
  '肝右叶S6段', '肝左叶S3段', '肝尾状叶', '右侧甲状腺上极', '左侧甲状腺下极',
  '右侧乳腺外上象限', '左侧乳腺内下象限', 'L4/5椎间盘', 'C5/6椎间盘', '右侧脑室旁'];

const FINDING_TEMPLATES = [
  '于{location}可见类圆形{name}，大小约{diameter}mm，边界清晰。',
  '{location}可见不规则形{name}，最大径约{diameter}mm，增强扫描可见强化。',
  '检出{name}，位于{location}，直径约{diameter}mm，CT值约{hu}HU。',
  '{location}见多发{name}，较大者直径约{diameter}mm，与上次对比无明显变化。',
  '可见{name}样改变，累及{location}，范围约{diameter}mm×{diameter2}mm。',
];

const IMPRESSION_TEMPLATES = [
  '考虑{name}，建议短期随访复查。',
  '上述所见，{name}可能性大，建议结合临床进一步检查。',
  '{name}，请结合病史，必要时增强扫描。',
  '符合{name}表现，建议定期复查观察变化。',
  '考虑为{name}，与前次检查相比无显著变化。',
];

const MEASUREMENT_TEMPLATES = [
  '测量：{name}最大径约{diameter}mm，体积约{volume}mm³。',
  '病灶测量：直径{diameter}mm，平均CT值{hu}HU。',
  '体积分析：{name}体积为{volume}mm³，与上次对比变化率为{change}%。',
  '径线测量：长径{diameter}mm，短径{diameter2}mm，近似体积{volume}mm³。',
];

const LABEL_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const REJECT_TEMPLATES_DEFAULT = [
  { code: 'REJ-001', title: '标注漏检', description: 'AI未检出明确可见的病灶，存在漏检情况。' },
  { code: 'REJ-002', title: '误检标注', description: 'AI标注的病灶为伪影或正常解剖结构，需剔除。' },
  { code: 'REJ-003', title: '分类错误', description: '病灶性质分类错误，良恶性判断不准确。' },
  { code: 'REJ-004', title: '测量不准', description: '病灶测量数据与实际偏差较大，需重新测量。' },
  { code: 'REJ-005', title: '描述不当', description: '报告语句描述不准确，与影像表现不符。' },
  { code: 'REJ-006', title: '遗漏对比', description: '未与历史检查进行有效对比，遗漏重要变化信息。' },
  { code: 'REJ-007', title: '格式错误', description: '报告格式不规范，不符合科室书写要求。' },
  { code: 'REJ-008', title: '影像质量差', description: '原始影像质量不佳，影响AI分析结果。' },
];

const REJECT_TEMPLATES_CUSTOM = [
  { code: 'CUS-001', title: '需增强扫描', description: '建议补充增强扫描以进一步明确病变性质。' },
  { code: 'CUS-002', title: '请结合病理', description: '建议结合病理活检结果综合判断。' },
];

export const defaultUserPreferences: UserPreferences = {
  defaultSort: 'sla',
  defaultWindowMode: 'split',
  slaWarnThresholdHours: 1,
  slaDangerThresholdHours: 2,
  significantChangeThreshold: 20,
  enableShortcuts: true,
  rejectedTemplateFavorites: ['REJ-001', 'REJ-002', 'REJ-005'],
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatDateISO(date: Date): string {
  return date.toISOString();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function generatePatientName(rng: SeededRandom, gender: 'M' | 'F'): string {
  const first = gender === 'M'
    ? PATIENT_FIRST_NAMES_M[rng.nextInt(0, PATIENT_FIRST_NAMES_M.length - 1)]
    : PATIENT_FIRST_NAMES_F[rng.nextInt(0, PATIENT_FIRST_NAMES_F.length - 1)];
  const last = PATIENT_LAST_NAMES[rng.nextInt(0, PATIENT_LAST_NAMES.length - 1)];
  return first + last;
}

export function generateMockTasks(count: number = 30): ExamTask[] {
  const rng = new SeededRandom(20240115);
  const now = new Date('2026-06-17T09:00:00');
  const tasks: ExamTask[] = [];

  for (let i = 0; i < count; i++) {
    const examType = EXAM_TYPES[i % 6];
    const gender: 'M' | 'F' = rng.nextInt(0, 1) === 0 ? 'M' : 'F';
    const age = rng.nextInt(18, 85);
    const patientName = generatePatientName(rng, gender);

    const daysAgo = rng.nextInt(0, 2);
    const hoursOffset = rng.nextInt(-8, -1);
    const examTime = addMinutes(addHours(addDays(now, -daysAgo), hoursOffset), -rng.nextInt(30, 90));
    const receiveTime = addMinutes(examTime, rng.nextInt(15, 60));

    let priority: PriorityLevel = 'normal';
    let slaHours = 4;
    if (i % 10 === 0) {
      priority = 'emergency';
      slaHours = 0.5;
    } else if (i % 5 === 0) {
      priority = 'urgent';
      slaHours = 2;
    } else if (i % 7 === 0) {
      priority = 'urgent';
      slaHours = 2;
    }

    const slaDeadline = addHours(receiveTime, slaHours);

    let status: ReviewStatus = 'pending';
    if (i % 11 === 0 || slaDeadline < now) {
      status = 'timeout';
    } else if (i % 9 === 0) {
      status = 'passed';
    } else if (i % 13 === 0) {
      status = 'rejected';
    }

    const examPart = rng.pick(EXAM_PARTS[examType]);
    const lesionalCount = rng.nextInt(0, 6);
    const aiConfidence = rng.nextFloat(0.65, 0.99, 3);

    const historyExamIds: string[] = [];
    if (rng.next() > 0.35) {
      historyExamIds.push(`EXAM-${rng.nextInt(100000, 999999)}`);
      if (rng.next() > 0.6) {
        historyExamIds.push(`EXAM-${rng.nextInt(100000, 999999)}`);
      }
    }

    const hasSignificantChange = rng.next() > 0.7;

    tasks.push({
      taskId: `TASK-2026${String(617000 + i).padStart(6, '0')}`,
      patient: {
        id: `P${rng.nextInt(100000, 999999)}`,
        name: patientName,
        gender,
        age,
        bedNo: rng.next() > 0.4 ? `${rng.nextInt(1, 20)}${String.fromCharCode(65 + rng.nextInt(0, 3))}${String(rng.nextInt(1, 48)).padStart(2, '0')}` : undefined,
        department: rng.pick(DEPARTMENTS),
      },
      examType,
      examPart,
      examTime: formatDateISO(examTime),
      receiveTime: formatDateISO(receiveTime),
      aiConfidence,
      priority,
      status,
      slaDeadline: formatDateISO(slaDeadline),
      historyExamIds: historyExamIds.length > 0 ? historyExamIds : undefined,
      lesionalCount,
      hasSignificantChange,
    });
  }

  return tasks;
}

export function generateMockLesions(taskId: string): LesionMeasurement[] {
  const rng = new SeededRandom(hashString(taskId));
  const examType = taskId.includes('CT') ? 'CT' :
    taskId.includes('MR') ? 'MR' :
    taskId.includes('DR') ? 'DR' :
    taskId.includes('US') ? 'US' :
    taskId.includes('DSA') ? 'DSA' : 'MG';

  const actualExamType: ExamType = EXAM_TYPES[hashString(taskId) % 6];
  const count = rng.nextInt(2, 5);
  const lesions: LesionMeasurement[] = [];
  const availableNames = [...LESION_NAMES[actualExamType]];
  const shuffledNames = rng.shuffle(availableNames);

  for (let i = 0; i < count; i++) {
    const diameter = rng.nextFloat(3, 45, 1);
    const hasHistory = rng.next() > 0.3;
    const lastDiameter = hasHistory ? rng.nextFloat(Math.max(2, diameter * 0.6), diameter * 1.4, 1) : undefined;
    const changeRate = hasHistory && lastDiameter ? Number((((diameter - lastDiameter) / lastDiameter) * 100).toFixed(1)) : undefined;
    const significantChangeThreshold = 20;
    const isSignificantChange = hasHistory && changeRate !== undefined && Math.abs(changeRate) >= significantChangeThreshold;

    lesions.push({
      id: `${taskId}-L${String(i + 1).padStart(2, '0')}`,
      taskId,
      name: shuffledNames[i % shuffledNames.length],
      location: rng.pick(LESION_LOCATIONS),
      diameter,
      volume: rng.next() > 0.4 ? rng.nextFloat(20, 50000, 1) : undefined,
      huValue: (actualExamType === 'CT' || actualExamType === 'DSA') ? rng.nextInt(-80, 120) : undefined,
      lastDiameter,
      lastExamDate: hasHistory ? formatDateISO(addDays(new Date('2026-06-17'), -rng.nextInt(30, 180))) : undefined,
      changeRate,
      isSignificantChange,
      boundingBox: {
        x: rng.nextInt(20, 480),
        y: rng.nextInt(20, 480),
        w: rng.nextInt(10, 80),
        h: rng.nextInt(10, 80),
        slice: rng.nextInt(1, 120),
      },
      labelColor: rng.pick(LABEL_COLORS),
    });
  }

  return lesions;
}

export function generateMockSuggestions(taskId: string): SuggestionSentence[] {
  const rng = new SeededRandom(hashString(taskId) + 1000);
  const lesions = generateMockLesions(taskId);
  const lesionIds = lesions.map(l => l.id);
  const count = rng.nextInt(5, 10);
  const suggestions: SuggestionSentence[] = [];
  const categories: Array<'finding' | 'impression' | 'measurement'> = ['finding', 'impression', 'measurement'];

  for (let i = 0; i < count; i++) {
    const category = categories[i % 3];
    const lesion = lesions[i % lesions.length];
    const diameter2 = rng.nextFloat(Math.max(2, lesion.diameter * 0.5), lesion.diameter, 1);
    const volume = lesion.volume ?? rng.nextFloat(50, 20000, 1);
    const hu = lesion.huValue ?? rng.nextInt(-20, 80);
    const change = lesion.changeRate ?? rng.nextFloat(-15, 15, 1);

    let content = '';
    const templateIdx = rng.nextInt(0, 4);
    if (category === 'finding') {
      content = FINDING_TEMPLATES[templateIdx]
        .replace('{location}', lesion.location)
        .replace(/{name}/g, lesion.name)
        .replace('{diameter}', String(lesion.diameter))
        .replace('{diameter2}', String(diameter2))
        .replace('{hu}', String(hu));
    } else if (category === 'impression') {
      content = IMPRESSION_TEMPLATES[templateIdx].replace(/{name}/g, lesion.name);
    } else {
      content = MEASUREMENT_TEMPLATES[templateIdx]
        .replace('{name}', lesion.name)
        .replace('{diameter}', String(lesion.diameter))
        .replace('{diameter2}', String(diameter2))
        .replace('{volume}', String(volume))
        .replace('{hu}', String(hu))
        .replace('{change}', String(change));
    }

    const decisionRoll = rng.next();
    let decision: 'keep' | 'remove' | 'edit' = 'keep';
    if (decisionRoll > 0.85) {
      decision = 'remove';
    } else if (decisionRoll > 0.7) {
      decision = 'edit';
    }

    const evidenceCount = rng.nextInt(0, Math.min(3, lesionIds.length));
    const evidenceLesionIds = evidenceCount > 0
      ? rng.shuffle(lesionIds).slice(0, evidenceCount)
      : [lesion.id];

    suggestions.push({
      id: `${taskId}-S${String(i + 1).padStart(2, '0')}`,
      taskId,
      content,
      category,
      confidence: rng.nextFloat(0.72, 0.98, 3),
      evidenceLesionIds,
      decision,
      editedContent: decision === 'edit' ? content + '（经人工修正）' : undefined,
      modifiedBy: decision !== 'keep' ? '李医生' : undefined,
      modifiedAt: decision !== 'keep' ? formatDateISO(new Date('2026-06-17T10:30:00')) : undefined,
      revisionHistory: decision === 'edit' ? [
        {
          id: `${taskId}-R${i}`,
          action: 'replace',
          beforeText: content,
          afterText: content + '（经人工修正）',
          operator: '李医生',
          timestamp: formatDateISO(new Date('2026-06-17T10:30:00')),
        },
      ] : undefined,
    });
  }

  return suggestions;
}

export function generateMockRejectTemplates(): RejectTemplate[] {
  const rng = new SeededRandom(7777);
  const templates: RejectTemplate[] = [];

  REJECT_TEMPLATES_DEFAULT.forEach((t, i) => {
    templates.push({
      id: `TPL-DEFAULT-${String(i + 1).padStart(2, '0')}`,
      code: t.code,
      title: t.title,
      description: t.description,
      isDefault: true,
      usageCount: rng.nextInt(5, 150),
    });
  });

  REJECT_TEMPLATES_CUSTOM.forEach((t, i) => {
    templates.push({
      id: `TPL-CUSTOM-${String(i + 1).padStart(2, '0')}`,
      code: t.code,
      title: t.title,
      description: t.description,
      isDefault: false,
      usageCount: rng.nextInt(1, 30),
    });
  });

  return templates.sort((a, b) => b.usageCount - a.usageCount);
}

export function generateMockStats(period: '7d' | '30d'): PersonalStats {
  const rng = new SeededRandom(period === '7d' ? 777 : 3000);
  const days = period === '7d' ? 7 : 30;
  const now = new Date('2026-06-17');

  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(now, -i);
    dailyCounts.push({
      date: d.toISOString().split('T')[0],
      count: rng.nextInt(8, 35),
    });
  }

  const totalReviewed = dailyCounts.reduce((sum, d) => sum + d.count, 0);
  const rejectedCount = Math.floor(totalReviewed * rng.nextFloat(0.08, 0.18, 2));
  const passedCount = totalReviewed - rejectedCount;
  const passRate = Number(((passedCount / totalReviewed) * 100).toFixed(1));

  const rejectReasonsData = [
    { reason: '标注漏检', weight: 0.28 },
    { reason: '误检标注', weight: 0.22 },
    { reason: '分类错误', weight: 0.18 },
    { reason: '测量不准', weight: 0.12 },
    { reason: '描述不当', weight: 0.10 },
    { reason: '其他', weight: 0.10 },
  ];

  const rejectReasons = rejectReasonsData.map(r => {
    const count = Math.max(1, Math.floor(rejectedCount * r.weight));
    return {
      reason: r.reason,
      count,
      percent: Number(((count / rejectedCount) * 100).toFixed(1)),
    };
  });

  const byExamTypeData = EXAM_TYPES.map(examType => {
    const baseWeights: Record<ExamType, number> = {
      CT: 0.32, MR: 0.22, DR: 0.20, US: 0.14, DSA: 0.06, MG: 0.06,
    };
    const count = Math.max(1, Math.floor(totalReviewed * baseWeights[examType] * rng.nextFloat(0.85, 1.15, 2)));
    return { examType, count };
  });

  const totalByExam = byExamTypeData.reduce((s, e) => s + e.count, 0);
  const diff = totalReviewed - totalByExam;
  if (diff !== 0) {
    byExamTypeData[0].count += diff;
  }

  return {
    period,
    totalReviewed,
    passedCount,
    rejectedCount,
    passRate,
    avgDurationSeconds: rng.nextInt(90, 320),
    slaComplianceRate: rng.nextFloat(88, 98, 1),
    dailyCounts,
    rejectReasons,
    byExamType: byExamTypeData,
  };
}

export default {
  generateMockTasks,
  generateMockLesions,
  generateMockSuggestions,
  generateMockRejectTemplates,
  generateMockStats,
  defaultUserPreferences,
};
