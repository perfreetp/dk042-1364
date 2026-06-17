import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Activity,
  CheckCircle2,
  XCircle,
  Gauge,
  ScanEye,
  BarChart3,
  ListFilter,
  Layers,
  Settings,
  RotateCcw,
  Save,
  ChevronDown,
  Inbox,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell as RechartsCell,
} from 'recharts';
import { useStatsStore } from '@/stores/useStatsStore';
import { usePreferenceStore } from '@/stores/usePreferenceStore';
import { useBatchStore } from '@/stores/useBatchStore';
import type { UserPreferences, SortBy } from '@/types';
import { cn } from '@/utils';

const PIE_COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'sla', label: 'SLA 剩余时间' },
  { value: 'priority', label: '优先级' },
  { value: 'time', label: '接收时间' },
  { value: 'confidence', label: 'AI 置信度' },
];

const WINDOW_MODE_OPTIONS = [
  { value: 'split' as const, label: '并排模式' },
  { value: 'overlay' as const, label: '叠加模式' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Preferences() {
  const location = useLocation();
  const { period, stats, setPeriod } = useStatsStore();
  const { preferences, updatePreferences, resetToDefaults } = usePreferenceStore();
  const { rejectTemplates } = useBatchStore();

  const [draftPreferences, setDraftPreferences] = useState<UserPreferences>({ ...preferences });
  const [saved, setSaved] = useState(false);

  const handleChange = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setDraftPreferences((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    const prevWindowMode = preferences.defaultWindowMode;
    updatePreferences(draftPreferences);

    if (
      draftPreferences.defaultWindowMode !== prevWindowMode &&
      location.pathname === '/compare'
    ) {
      // ImageCompare 会通过 usePreferenceStore 的订阅自动响应变化
      // useEffect(preferences) → setCompareMode，因此无需额外 dispatch
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetToDefaults();
    setDraftPreferences({ ...usePreferenceStore.getState().preferences });
    setSaved(false);
  };

  const rejectionRate = useMemo(() => {
    if (stats.totalReviewed === 0) return 0;
    return Number(((stats.rejectedCount / stats.totalReviewed) * 100).toFixed(1));
  }, [stats]);

  const lesionConsistencyRate = useMemo(() => {
    const seed = stats.period === '7d' ? 92.3 : 91.8;
    return seed;
  }, [stats.period]);

  const periodChange = useMemo(() => {
    const seed = stats.period === '7d' ? 8.5 : 12.3;
    const isUp = stats.period === '7d';
    return { value: seed, isUp };
  }, [stats.period]);

  const slaColor =
    stats.slaComplianceRate >= 95
      ? 'text-emerald-400'
      : stats.slaComplianceRate >= 90
        ? 'text-amber-400'
        : 'text-red-400';

  const slaBadge =
    stats.slaComplianceRate >= 95
      ? 'bg-emerald-500/15 border-emerald-500/30'
      : stats.slaComplianceRate >= 90
        ? 'bg-amber-500/15 border-amber-500/30'
        : 'bg-red-500/15 border-red-500/30';

  const slaIconColor =
    stats.slaComplianceRate >= 95
      ? '#34d399'
      : stats.slaComplianceRate >= 90
        ? '#fbbf24'
        : '#f87171';

  const favoriteTemplates = rejectTemplates.filter((t) =>
    draftPreferences.rejectedTemplateFavorites.includes(t.id),
  );

  const dailyChartData = useMemo(
    () =>
      stats.dailyCounts.map((d) => ({
        ...d,
        shortDate: d.date.slice(5),
      })),
    [stats.dailyCounts],
  );

  const pieData = useMemo(
    () =>
      stats.rejectReasons.map((r) => ({
        name: r.reason,
        value: r.count,
        percent: r.percent,
      })),
    [stats.rejectReasons],
  );

  const examTypeChartData = useMemo(
    () => [...stats.byExamType].sort((a, b) => b.count - a.count),
    [stats.byExamType],
  );

  const maxExamCount = useMemo(() => {
    const counts = examTypeChartData.map((e) => e.count);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [examTypeChartData]);

  return (
    <div className="window-content flex gap-4 h-full">
      {/* 左：统计区 w-2/3 */}
      <div className="w-2/3 flex flex-col gap-4 min-w-0">
        {/* 标题 + 周期切换 */}
        <div className="card-base p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm bg-medical-600/20 border border-medical-600/40 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-medical-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-100">个人审核效率统计</h2>
                <p className="text-xs text-zinc-500 mt-0.5">基于历史审核数据分析</p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-zinc-800/60 rounded-sm border border-zinc-700">
              {(['7d', '30d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1.5 rounded-sm text-sm transition-colors',
                    period === p
                      ? 'bg-medical-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {p === '7d' ? '近 7 天' : '近 30 天'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 可滚动的统计内容 */}
        <div className="flex-1 overflow-auto scrollbar-thin space-y-4 pb-2">
          {/* 6 个指标卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={ClipboardList}
              iconColor="text-medical-400"
              iconBg="bg-medical-500/15"
              title="审核总量"
              value={stats.totalReviewed.toString()}
              suffix="例"
              trend={periodChange}
            />
            <StatCard
              icon={CheckCircle2}
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/15"
              title="通过率"
              value={`${stats.passRate}%`}
              progress={stats.passRate}
              progressColor="bg-emerald-500"
            />
            <StatCard
              icon={XCircle}
              iconColor="text-red-400"
              iconBg="bg-red-500/15"
              title="驳回率"
              value={`${rejectionRate}%`}
            />
            <StatCard
              icon={Clock}
              iconColor="text-amber-400"
              iconBg="bg-amber-500/15"
              title="平均审核时长"
              value={formatDuration(stats.avgDurationSeconds)}
            />
            <div className="card-base p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-sm border flex items-center justify-center',
                      slaBadge,
                    )}
                  >
                    <Target className="w-5 h-5" style={{ color: slaIconColor }} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">SLA 达标率</div>
                    <div className={cn('text-2xl font-semibold mt-1', slaColor)}>
                      {stats.slaComplianceRate}%
                    </div>
                  </div>
                </div>
                {stats.slaComplianceRate < 90 && (
                  <div className="mt-3 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-sm border border-red-500/20 w-full">
                    需注意超时风险
                  </div>
                )}
              </div>
            </div>
            <StatCard
              icon={ScanEye}
              iconColor="text-violet-400"
              iconBg="bg-violet-500/15"
              title="病灶检出一致率"
              value={`${lesionConsistencyRate}%`}
              progress={lesionConsistencyRate}
              progressColor="bg-violet-500"
            />
          </div>

          {/* 柱状图 + 饼图 */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 card-base p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-medical-400" />
                  <h3 className="text-sm font-medium text-zinc-200">日审核量</h3>
                </div>
                <div className="text-xs text-zinc-500">单位：例</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyChartData}
                    margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={{ stroke: '#3f3f46' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={{ stroke: '#3f3f46' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '2px',
                        fontSize: '12px',
                        color: '#e4e4e7',
                      }}
                      labelStyle={{ color: '#a1a1aa' }}
                      formatter={(value: number) => [`${value} 例`, '审核量']}
                    />
                    <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-2 card-base p-4">
              <div className="flex items-center gap-2 mb-4">
                <ListFilter className="w-4 h-4 text-medical-400" />
                <h3 className="text-sm font-medium text-zinc-200">驳回原因分布</h3>
              </div>
              <div className="h-56">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <Inbox className="w-10 h-10 text-zinc-600" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={68}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${percent}%`
                        }
                        labelLine={{ stroke: '#52525b' }}
                      >
                        {pieData.map((_, index) => (
                          <RechartsCell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '2px',
                          fontSize: '12px',
                          color: '#e4e4e7',
                        }}
                        formatter={(value: number, name: string) => [`${value} 例`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* 检查类型分布 */}
          <div className="card-base p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-medical-400" />
                <h3 className="text-sm font-medium text-zinc-200">检查类型分布</h3>
              </div>
              <div className="text-xs text-zinc-500">各类型审核数量</div>
            </div>
            <div className="space-y-3">
              {examTypeChartData.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm">暂无数据</div>
              ) : (
                examTypeChartData.map((item) => (
                  <div key={item.examType} className="flex items-center gap-3">
                    <div className="w-10 text-sm font-medium text-zinc-300 shrink-0">
                      {item.examType}
                    </div>
                    <div className="flex-1 h-6 bg-zinc-800/60 rounded-sm overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-medical-600 to-medical-500 rounded-sm transition-all"
                        style={{ width: `${(item.count / maxExamCount) * 100}%` }}
                      />
                    </div>
                    <div className="w-14 text-right text-sm font-mono tabular-nums text-zinc-400 shrink-0">
                      {item.count} 例
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右：偏好设置 w-1/3 */}
      <div className="w-1/3 flex flex-col gap-4 min-w-0">
        <div className="card-base p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-medical-600/20 border border-medical-600/40 flex items-center justify-center">
              <Settings className="w-5 h-5 text-medical-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">偏好设置</h2>
              <p className="text-xs text-zinc-500 mt-0.5">自定义工作习惯与阈值</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin space-y-4 pb-2">
          {/* 显示偏好 */}
          <div className="card-base p-4">
            <h3 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-medical-400" />
              显示偏好
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">列表默认排序</label>
                <div className="relative">
                  <select
                    value={draftPreferences.defaultSort}
                    onChange={(e) => handleChange('defaultSort', e.target.value as SortBy)}
                    className="w-full appearance-none bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 pl-3 pr-8 py-2 rounded-sm focus:outline-none focus:border-medical-500 cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">影像默认对照模式</label>
                <div className="flex gap-2">
                  {WINDOW_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleChange('defaultWindowMode', opt.value)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-sm text-sm border transition-colors',
                        draftPreferences.defaultWindowMode === opt.value
                          ? 'bg-medical-600/20 text-medical-300 border-medical-500/60'
                          : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:border-zinc-600',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  显著变化阈值
                  <span className="text-zinc-600 ml-1">(%)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftPreferences.significantChangeThreshold}
                    onChange={(e) =>
                      handleChange('significantChangeThreshold', Number(e.target.value))
                    }
                    className="w-24 px-3 py-2 rounded-sm bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-medical-500"
                  />
                  <span className="text-xs text-zinc-500">病灶变化超过此比例视为显著变化</span>
                </div>
              </div>
            </div>
          </div>

          {/* SLA 阈值 */}
          <div className="card-base p-4">
            <h3 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-medical-400" />
              SLA 阈值
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-300">黄色警告阈值</div>
                  <div className="text-xs text-zinc-500">剩余时间 ≤ 此时长显示黄色</div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draftPreferences.slaWarnThresholdHours}
                    onChange={(e) =>
                      handleChange('slaWarnThresholdHours', Number(e.target.value))
                    }
                    className="w-20 px-3 py-2 rounded-sm bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 text-center"
                  />
                  <span className="text-xs text-zinc-500 ml-1">小时</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-300">红色危险阈值</div>
                  <div className="text-xs text-zinc-500">剩余时间 ≤ 此时长显示红色</div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draftPreferences.slaDangerThresholdHours}
                    onChange={(e) =>
                      handleChange('slaDangerThresholdHours', Number(e.target.value))
                    }
                    className="w-20 px-3 py-2 rounded-sm bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-red-500 text-center"
                  />
                  <span className="text-xs text-zinc-500 ml-1">小时</span>
                </div>
              </div>
            </div>
          </div>

          {/* 操作偏好 */}
          <div className="card-base p-4">
            <h3 className="text-sm font-medium text-zinc-200 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-medical-400" />
              操作偏好
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-zinc-300">启用快捷键</div>
                  <div className="text-xs text-zinc-500">支持键盘快捷键快速操作</div>
                </div>
                <button
                  onClick={() => handleChange('enableShortcuts', !draftPreferences.enableShortcuts)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative shrink-0',
                    draftPreferences.enableShortcuts ? 'bg-medical-600' : 'bg-zinc-700',
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow',
                      draftPreferences.enableShortcuts
                        ? 'translate-x-5'
                        : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">常用驳回模板</label>
                <div className="space-y-1.5 max-h-52 overflow-auto scrollbar-thin pr-1">
                  {rejectTemplates.length === 0 ? (
                    <div className="py-4 text-center text-zinc-500 text-sm">暂无模板</div>
                  ) : (
                    rejectTemplates.map((tpl) => {
                      const isFav = draftPreferences.rejectedTemplateFavorites.includes(tpl.id);
                      return (
                        <label
                          key={tpl.id}
                          className="flex items-start gap-2 p-2 rounded-sm bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isFav}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...draftPreferences.rejectedTemplateFavorites, tpl.id]
                                : draftPreferences.rejectedTemplateFavorites.filter(
                                    (id) => id !== tpl.id,
                                  );
                              handleChange('rejectedTemplateFavorites', next);
                            }}
                            className="mt-0.5 w-4 h-4 rounded-sm accent-medical-500 bg-zinc-800 border-zinc-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-zinc-200 truncate">{tpl.title}</div>
                            <div className="text-xs text-zinc-500 truncate">
                              {tpl.code} · 使用 {tpl.usageCount} 次
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {favoriteTemplates.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500">
                      已选 {favoriteTemplates.length} 个常用模板
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="card-base p-4 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="btn-ghost flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              <span>恢复默认</span>
            </button>
            <button
              onClick={handleSave}
              className={cn(
                'btn-primary flex items-center gap-1.5 flex-1 justify-center transition-all',
                saved && 'bg-emerald-600 border-emerald-500',
              )}
            >
              <Save className="w-4 h-4" />
              <span>{saved ? '已保存 ✓' : '保存设置'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string;
  suffix?: string;
  trend?: { value: number; isUp: boolean };
  progress?: number;
  progressColor?: string;
}

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  value,
  suffix,
  trend,
  progress,
  progressColor,
}: StatCardProps) {
  return (
    <div className="card-base p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-9 h-9 rounded-sm border border-zinc-700 flex items-center justify-center',
              iconBg,
            )}
          >
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
          <div>
            <div className="text-xs text-zinc-500">{title}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-semibold text-zinc-100">{value}</span>
              {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
            </div>
          </div>
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-xs',
              trend.isUp
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-red-400 bg-red-500/10',
            )}
          >
            {trend.isUp ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{trend.value}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-3.5 h-3.5" />
                <span>-{trend.value}%</span>
              </>
            )}
          </div>
        )}
      </div>
      {progress !== undefined && progressColor && (
        <div className="mt-3 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
          <div
            className={cn('h-full rounded-sm transition-all', progressColor)}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
