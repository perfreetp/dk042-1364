import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  Ruler,
  Pencil,
  ArrowRight,
  Image as ImageIcon,
  Layers,
  Eye,
  EyeOff,
  ListTodo,
} from 'lucide-react';
import { useTaskStore } from '@/stores/useTaskStore';
import { useLesionStore } from '@/stores/useLesionStore';
import { usePreferenceStore } from '@/stores/usePreferenceStore';
import type { LesionMeasurement, CompareMode, ExamTask } from '@/types';
import { cn, formatDateTime } from '@/utils';

type ToolMode = 'pan' | 'measure' | 'annotate';

interface WindowPreset {
  name: string;
  ww: number;
  wl: number;
}

const WINDOW_PRESETS: WindowPreset[] = [
  { name: '肺窗', ww: 1500, wl: -600 },
  { name: '纵隔', ww: 400, wl: 40 },
  { name: '脑窗', ww: 100, wl: 40 },
  { name: '腹部', ww: 400, wl: 50 },
];

const COMPARE_TABS: { mode: CompareMode; label: string; icon: typeof Eye }[] = [
  { mode: 'split', label: '并排', icon: Layers },
  { mode: 'overlay', label: '叠加', icon: ImageIcon },
  { mode: 'raw', label: '仅原始', icon: Eye },
  { mode: 'labeled', label: '仅标注', icon: EyeOff },
];

export default function ImageCompare() {
  const navigate = useNavigate();

  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);

  const lesions = useLesionStore((s) => s.lesions);
  const selectedLesionId = useLesionStore((s) => s.selectedLesionId);
  const compareMode = useLesionStore((s) => s.compareMode);
  const setLesionsForTask = useLesionStore((s) => s.setLesionsForTask);
  const selectLesion = useLesionStore((s) => s.selectLesion);
  const setCompareMode = useLesionStore((s) => s.setCompareMode);

  const preferences = usePreferenceStore((s) => s.preferences);

  const [currentSlice, setCurrentSlice] = useState(40);
  const [zoom, setZoom] = useState(100);
  const [toolMode, setToolMode] = useState<ToolMode>('pan');
  const [windowWW, setWindowWW] = useState(1500);
  const [windowWL, setWindowWL] = useState(-600);
  const [showBBoxInOverlay, setShowBBoxInOverlay] = useState(true);

  const selectedTask = useMemo<ExamTask | null>(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.taskId === selectedTaskId) || null;
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (selectedTaskId) {
      setLesionsForTask(selectedTaskId);
      setCurrentSlice(40);
      setZoom(100);
    }
  }, [selectedTaskId, setLesionsForTask]);

  useEffect(() => {
    const preset = WINDOW_PRESETS.find((p) => p.name === preferences.defaultWindowMode);
    if (preset) {
      setWindowWW(preset.ww);
      setWindowWL(preset.wl);
    }
  }, [preferences.defaultWindowMode]);

  const taskIndex = useMemo(() => {
    if (!selectedTaskId) return -1;
    return tasks.findIndex((t) => t.taskId === selectedTaskId);
  }, [selectedTaskId, tasks]);

  const handlePrevTask = () => {
    if (taskIndex > 0) {
      selectTask(tasks[taskIndex - 1].taskId);
    }
  };

  const handleNextTask = () => {
    if (taskIndex < tasks.length - 1) {
      selectTask(tasks[taskIndex + 1].taskId);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 400));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 25));
  const handleZoomReset = () => setZoom(100);

  const applyWindowPreset = (preset: WindowPreset) => {
    setWindowWW(preset.ww);
    setWindowWL(preset.wl);
  };

  const formatChangeRate = (rate: number | undefined): string => {
    if (rate === undefined) return '-';
    const sign = rate > 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%`;
  };

  const getChangeRateColor = (rate: number | undefined): string => {
    if (rate === undefined) return 'text-zinc-500';
    if (Math.abs(rate) >= preferences.significantChangeThreshold) {
      return rate > 0 ? 'text-review-reject' : 'text-review-pass';
    }
    return 'text-zinc-400';
  };

  if (!selectedTask) {
    return (
      <div className="window-content flex items-center justify-center">
        <div className="card-base p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-zinc-800 flex items-center justify-center">
            <ListTodo className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-3">
            暂无选中的审核任务
          </h3>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            请先前往「任务列表」页面，从待审队列中选择一个任务开始影像对照审核。
          </p>
          <button
            onClick={() => navigate('/tasks')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <ListTodo className="w-4 h-4" />
            前往待审列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="window-content flex gap-3 h-full overflow-hidden">
      {/* 左：病灶列表侧栏 */}
      <aside className="w-72 shrink-0 flex flex-col gap-3">
        <div className="card-base p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-zinc-200">
              检出病灶
              <span className="text-zinc-400 font-normal ml-1">
                ({lesions.length}个)
              </span>
            </h2>
            {lesions.some((l) => l.isSignificantChange) && (
              <span className="text-xs px-2 py-0.5 rounded-sm bg-review-diff/15 text-review-diff border border-review-diff/30">
                显著变化高亮
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-0.5 space-y-2">
          {lesions.length === 0 ? (
            <div className="card-base p-6 text-center">
              <p className="text-sm text-zinc-500">未检出病灶</p>
            </div>
          ) : (
            lesions.map((lesion) => (
              <LesionCard
                key={lesion.id}
                lesion={lesion}
                isSelected={lesion.id === selectedLesionId}
                onClick={() => selectLesion(lesion.id)}
                changeRateColor={getChangeRateColor(lesion.changeRate)}
                formatChangeRate={formatChangeRate}
              />
            ))
          )}
        </div>
      </aside>

      {/* 中：影像对照区 */}
      <section className="flex-1 flex flex-col gap-2 min-w-0">
        {/* 顶部 compareMode tab */}
        <div className="card-base p-1.5 flex items-center gap-1 flex-shrink-0">
          {COMPARE_TABS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setCompareMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors',
                compareMode === mode
                  ? 'bg-medical-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}

          {compareMode === 'overlay' && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
              <button
                onClick={() => setShowBBoxInOverlay(!showBBoxInOverlay)}
                className="flex items-center gap-1 px-2 py-1 rounded-sm hover:bg-zinc-800/60 transition-colors"
              >
                {showBBoxInOverlay ? (
                  <Eye className="w-3.5 h-3.5 text-medical-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>定位框</span>
              </button>
            </div>
          )}
        </div>

        {/* 影像显示区 */}
        <div className="flex-1 card-base p-2 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 relative overflow-hidden bg-black">
            {compareMode === 'split' ? (
              <div className="h-full grid grid-cols-2 gap-2">
                <ImageViewport
                  label="原始影像"
                  lesions={[]}
                  selectedLesionId={null}
                  zoom={zoom}
                  windowWW={windowWW}
                  windowWL={windowWL}
                  currentSlice={currentSlice}
                />
                <ImageViewport
                  label="AI 标注"
                  lesions={lesions}
                  selectedLesionId={selectedLesionId}
                  zoom={zoom}
                  windowWW={windowWW}
                  windowWL={windowWL}
                  currentSlice={currentSlice}
                  onLesionClick={selectLesion}
                />
              </div>
            ) : (
              <ImageViewport
                label={
                  compareMode === 'overlay'
                    ? '叠加视图'
                    : compareMode === 'raw'
                    ? '原始影像'
                    : 'AI 标注'
                }
                lesions={
                  compareMode === 'raw'
                    ? []
                    : compareMode === 'overlay' && !showBBoxInOverlay
                    ? []
                    : lesions
                }
                selectedLesionId={selectedLesionId}
                zoom={zoom}
                windowWW={windowWW}
                windowWL={windowWL}
                currentSlice={currentSlice}
                onLesionClick={
                  compareMode !== 'raw' ? selectLesion : undefined
                }
                overlayMode={compareMode === 'overlay'}
                showBBox={
                  compareMode === 'overlay' ? showBBoxInOverlay : true
                }
              />
            )}
          </div>

          {/* 切片滑动条 */}
          <div className="flex-shrink-0 mt-2 px-2 py-2 rounded-sm bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-16 shrink-0 font-mono">
                Slice 1
              </span>
              <input
                type="range"
                min={1}
                max={80}
                value={currentSlice}
                onChange={(e) => setCurrentSlice(Number(e.target.value))}
                className="flex-1 h-1.5 bg-zinc-700 rounded-sm appearance-none cursor-pointer accent-medical-500"
              />
              <span className="text-xs text-zinc-300 w-20 shrink-0 font-mono text-right tabular-nums">
                {currentSlice} / 80
              </span>
            </div>
          </div>

          {/* 窗宽窗位工具 */}
          <div className="flex-shrink-0 mt-2 px-3 py-2 rounded-sm bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">WW:</span>
                <span className="text-xs font-mono tabular-nums text-medical-400 w-14">
                  {windowWW}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">WL:</span>
                <span className="text-xs font-mono tabular-nums text-medical-400 w-14">
                  {windowWL}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {WINDOW_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyWindowPreset(preset)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-sm border transition-colors',
                    windowWW === preset.ww && windowWL === preset.wl
                      ? 'bg-medical-600/20 border-medical-500 text-medical-300'
                      : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 右：工具栏 */}
      <aside className="w-48 shrink-0 flex flex-col gap-3">
        {/* 缩放控制 */}
        <div className="card-base p-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            缩放
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomOut}
              className="flex-1 h-8 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 h-8 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono tabular-nums text-zinc-300 transition-colors min-w-[56px]"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="flex-1 h-8 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-300 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 工具切换 */}
        <div className="card-base p-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            工具
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            <ToolButton
              label="平移"
              icon={Move}
              active={toolMode === 'pan'}
              onClick={() => setToolMode('pan')}
            />
            <ToolButton
              label="测量"
              icon={Ruler}
              active={toolMode === 'measure'}
              onClick={() => setToolMode('measure')}
            />
            <ToolButton
              label="标注"
              icon={Pencil}
              active={toolMode === 'annotate'}
              onClick={() => setToolMode('annotate')}
            />
          </div>
        </div>

        {/* 患者信息 */}
        <div className="card-base p-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            患者信息
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">姓名</span>
              <span className="text-zinc-200 font-medium">
                {selectedTask.patient.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ID</span>
              <span className="text-zinc-300 font-mono">
                {selectedTask.patient.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">性别/年龄</span>
              <span className="text-zinc-300">
                {selectedTask.patient.gender === 'M' ? '男' : '女'} /{' '}
                {selectedTask.patient.age}岁
              </span>
            </div>
            <div className="h-px bg-zinc-800 my-1.5" />
            <div className="flex justify-between">
              <span className="text-zinc-500">检查类型</span>
              <span className="text-medical-400 font-medium">
                {selectedTask.examType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">部位</span>
              <span className="text-zinc-300">{selectedTask.examPart}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">检查时间</span>
            </div>
            <div className="text-zinc-300 font-mono text-[11px]">
              {formatDateTime(selectedTask.examTime)}
            </div>
          </div>
        </div>

        {/* 任务进度 */}
        <div className="card-base p-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
            任务进度
          </h3>
          <div className="text-xs text-zinc-300 mb-2 font-mono tabular-nums">
            {taskIndex + 1} / {tasks.length}
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-medical-500 rounded-sm transition-all"
              style={{
                width: `${((taskIndex + 1) / tasks.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 底部操作按钮组 */}
        <div className="mt-auto flex flex-col gap-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrevTask}
              disabled={taskIndex <= 0}
              className={cn(
                'h-9 rounded-sm border flex items-center justify-center gap-1 text-xs font-medium transition-colors',
                taskIndex <= 0
                  ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              上一例
            </button>
            <button
              onClick={handleNextTask}
              disabled={taskIndex >= tasks.length - 1}
              className={cn(
                'h-9 rounded-sm border flex items-center justify-center gap-1 text-xs font-medium transition-colors',
                taskIndex >= tasks.length - 1
                  ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
              )}
            >
              下一例
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => navigate('/confirm')}
            className="btn-primary h-10 flex items-center justify-center gap-1.5 text-sm"
          >
            进入报告审核
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}

interface LesionCardProps {
  lesion: LesionMeasurement;
  isSelected: boolean;
  onClick: () => void;
  changeRateColor: string;
  formatChangeRate: (rate: number | undefined) => string;
}

function LesionCard({
  lesion,
  isSelected,
  onClick,
  changeRateColor,
  formatChangeRate,
}: LesionCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card-base p-3 cursor-pointer transition-all border-2',
        isSelected
          ? 'bg-medical-600/20 border-medical-500'
          : lesion.isSignificantChange
          ? 'border-review-diff/70 animate-pulse-border'
          : 'hover:border-zinc-700 hover:bg-zinc-800/40',
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0"
          style={{ backgroundColor: lesion.labelColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-100 truncate">
            {lesion.name}
          </div>
          <div className="text-xs text-zinc-500 truncate mt-0.5">
            {lesion.location}
          </div>
        </div>
        {lesion.isSignificantChange && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-sm bg-review-diff/15 text-review-diff font-medium">
            Δ
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-zinc-500 mb-0.5">本次</div>
          <div className="font-mono text-zinc-200 tabular-nums">
            {lesion.diameter.toFixed(1)}mm
          </div>
        </div>
        <div>
          <div className="text-zinc-500 mb-0.5">历史</div>
          <div className="font-mono text-zinc-400 tabular-nums">
            {lesion.lastDiameter !== undefined
              ? `${lesion.lastDiameter.toFixed(1)}mm`
              : '-'}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 mb-0.5">变化率</div>
          <div
            className={cn(
              'font-mono tabular-nums font-medium',
              changeRateColor,
            )}
          >
            {formatChangeRate(lesion.changeRate)}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  icon: typeof Move;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ label, icon: Icon, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-2 rounded-sm border transition-colors',
        active
          ? 'bg-medical-600/20 border-medical-500 text-medical-300'
          : 'bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

interface ImageViewportProps {
  label: string;
  lesions: LesionMeasurement[];
  selectedLesionId: string | null;
  zoom: number;
  windowWW: number;
  windowWL: number;
  currentSlice: number;
  onLesionClick?: (lesionId: string | null) => void;
  overlayMode?: boolean;
  showBBox?: boolean;
}

function ImageViewport({
  label,
  lesions,
  selectedLesionId,
  zoom,
  windowWW,
  windowWL,
  currentSlice,
  onLesionClick,
  overlayMode = false,
  showBBox = true,
}: ImageViewportProps) {
  const scale = zoom / 100;
  const brightness = Math.max(0, Math.min(2, 0.85 + windowWL / 1000));
  const contrast = Math.max(0.5, Math.min(2, 0.9 + windowWW / 2000));

  const filteredLesions = lesions.filter(
    (l) => Math.abs(l.boundingBox.slice - currentSlice) <= 8,
  );

  return (
    <div className="relative h-full bg-black rounded-sm border border-zinc-800 overflow-hidden group">
      {/* 影像底图 */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={() => onLesionClick && onLesionClick(null)}
      >
        <div
          className="relative transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${scale})`,
            width: '90%',
            height: '90%',
            filter: `brightness(${brightness}) contrast(${contrast})`,
          }}
        >
          <div
            className="w-full h-full rounded-sm"
            style={{
              background:
                'radial-gradient(ellipse at center, #2a2a2a 0%, #0a0a0a 100%)',
            }}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* 胸廓轮廓 */}
              <ellipse
                cx="300"
                cy="300"
                rx="250"
                ry="240"
                fill="none"
                stroke="rgba(200,200,200,0.12)"
                strokeWidth="2"
              />
              {/* 左肺轮廓 */}
              <ellipse
                cx="190"
                cy="300"
                rx="100"
                ry="170"
                fill="rgba(120,120,120,0.08)"
                stroke="rgba(160,160,160,0.18)"
                strokeWidth="1"
              />
              {/* 右肺轮廓 */}
              <ellipse
                cx="410"
                cy="300"
                rx="105"
                ry="170"
                fill="rgba(120,120,120,0.08)"
                stroke="rgba(160,160,160,0.18)"
                strokeWidth="1"
              />
              {/* 肺纹理 - 左侧 */}
              <path
                d="M190 200 Q175 260 190 320 Q175 380 190 430"
                fill="none"
                stroke="rgba(180,180,180,0.1)"
                strokeWidth="0.8"
              />
              <path
                d="M160 250 Q175 300 165 360"
                fill="none"
                stroke="rgba(180,180,180,0.08)"
                strokeWidth="0.6"
              />
              {/* 肺纹理 - 右侧 */}
              <path
                d="M410 200 Q425 260 410 320 Q425 380 410 430"
                fill="none"
                stroke="rgba(180,180,180,0.1)"
                strokeWidth="0.8"
              />
              <path
                d="M440 250 Q425 300 435 360"
                fill="none"
                stroke="rgba(180,180,180,0.08)"
                strokeWidth="0.6"
              />
              {/* 心脏/纵隔 */}
              <ellipse
                cx="305"
                cy="310"
                rx="55"
                ry="80"
                fill="rgba(150,150,150,0.18)"
                stroke="rgba(200,200,200,0.15)"
                strokeWidth="1"
              />
              {/* 胸椎 */}
              <ellipse
                cx="300"
                cy="300"
                rx="20"
                ry="150"
                fill="rgba(180,180,180,0.12)"
              />
              <ellipse
                cx="300"
                cy="200"
                rx="15"
                ry="12"
                fill="rgba(220,220,220,0.3)"
              />
              <ellipse
                cx="300"
                cy="300"
                rx="16"
                ry="13"
                fill="rgba(220,220,220,0.28)"
              />
              <ellipse
                cx="300"
                cy="400"
                rx="15"
                ry="12"
                fill="rgba(220,220,220,0.26)"
              />
              {/* 模拟结节密度 */}
              <circle
                cx="195"
                cy="250"
                r="12"
                fill="rgba(210,210,210,0.35)"
              />
              <circle
                cx="400"
                cy="340"
                r="10"
                fill="rgba(200,200,200,0.3)"
              />
              <circle
                cx="180"
                cy="380"
                r="8"
                fill="rgba(190,190,190,0.25)"
              />
            </svg>

            {/* 十字准星 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-medical-500/30" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-medical-500/30" />
            </div>
          </div>

          {/* Bounding Boxes */}
          {showBBox &&
            filteredLesions.map((lesion) => {
              const isSelected = lesion.id === selectedLesionId;
              const left = (lesion.boundingBox.x / 600) * 100;
              const top = (lesion.boundingBox.y / 600) * 100;
              const width = (lesion.boundingBox.w / 600) * 100;
              const height = (lesion.boundingBox.h / 600) * 100;

              return (
                <div
                  key={lesion.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onLesionClick) onLesionClick(lesion.id);
                  }}
                  className={cn(
                    'absolute cursor-pointer transition-all',
                    isSelected && 'animate-pulse-border z-10',
                  )}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    border: `${isSelected ? '3px' : '2px'} solid ${lesion.labelColor}`,
                    boxSizing: 'border-box',
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-medium text-white rounded-sm whitespace-nowrap"
                      style={{ backgroundColor: lesion.labelColor }}
                    >
                      {lesion.name}
                    </div>
                  )}
                  {!isSelected && overlayMode && (
                    <div
                      className="absolute top-0 left-0 w-2 h-2"
                      style={{ backgroundColor: lesion.labelColor }}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* 左上角标签 */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded-sm bg-black/60 border border-zinc-800 text-[11px] text-zinc-300 font-medium backdrop-blur-sm">
        {label}
      </div>

      {/* 右上角窗宽窗位显示 */}
      <div className="absolute top-2 right-2 px-2 py-1 rounded-sm bg-black/60 border border-zinc-800 font-mono text-[10px] text-zinc-400 tabular-nums backdrop-blur-sm">
        WW: {windowWW} / WL: {windowWL}
      </div>

      {/* 左下角层厚信息 */}
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-sm bg-black/60 border border-zinc-800 font-mono text-[10px] text-zinc-400 tabular-nums backdrop-blur-sm">
        Slice {currentSlice}/80 · 1.0mm
      </div>

      {/* 右下角放大倍率 */}
      <div className="absolute bottom-2 right-2 px-2 py-1 rounded-sm bg-black/60 border border-zinc-800 font-mono text-[10px] text-medical-400 tabular-nums backdrop-blur-sm">
        {zoom}%
      </div>
    </div>
  );
}
