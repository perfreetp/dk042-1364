import { useState, useEffect, useMemo } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  ListTodo,
  Images,
  FileDiff,
  Layers,
  Settings,
  User,
  Clock,
  Hospital,
  X,
  RotateCcw,
} from "lucide-react";
import { useTaskStore } from "@/stores/useTaskStore";
import { usePreferenceStore } from "@/stores/usePreferenceStore";
import { cn, formatSlaRemaining } from "@/utils";
import type { ExamTask, ExamType, PacsWriteStatus } from "@/types";

const navItems = [
  { to: "/tasks", icon: ListTodo, label: "任务列表" },
  { to: "/compare", icon: Images, label: "影像对比" },
  { to: "/confirm", icon: FileDiff, label: "差异确认" },
  { to: "/batch", icon: Layers, label: "批量处理" },
  { to: "/preferences", icon: Settings, label: "偏好设置" },
];

const EXAM_TYPE_BADGE: Record<ExamType, string> = {
  CT: "bg-blue-600/80 border-blue-500 text-blue-100",
  MR: "bg-purple-600/80 border-purple-500 text-purple-100",
  DR: "bg-emerald-600/80 border-emerald-500 text-emerald-100",
  US: "bg-cyan-600/80 border-cyan-500 text-cyan-100",
  DSA: "bg-orange-600/80 border-orange-500 text-orange-100",
  MG: "bg-pink-600/80 border-pink-500 text-pink-100",
};

function formatClock(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getStatusBadge(task: ExamTask) {
  const status = task.status;
  const writeStatus: PacsWriteStatus = task.writeStatus ?? "idle";

  if (writeStatus === "writing") {
    return {
      label: "写入中",
      className: "bg-blue-900/60 border-blue-700 text-blue-300",
    };
  }
  if (writeStatus === "success" || (status === "passed" && writeStatus !== "failed")) {
    return {
      label: "已归档",
      className: "bg-green-900/60 border-green-700 text-green-300",
    };
  }
  if (writeStatus === "failed") {
    return {
      label: "写入失败(可重试)",
      className: "bg-red-900/60 border-red-700 text-red-300",
    };
  }
  if (status === "rejected") {
    return {
      label: "已驳回",
      className: "bg-orange-900/60 border-orange-700 text-orange-300",
    };
  }
  return {
    label: "待审",
    className: "bg-zinc-800/80 border-zinc-600 text-zinc-300",
  };
}

function TaskCard({ task }: { task: ExamTask }) {
  const preferences = usePreferenceStore((s) => s.preferences);
  const { text, level } = formatSlaRemaining(
    task.slaDeadline,
    preferences.slaWarnThresholdHours,
    preferences.slaDangerThresholdHours,
  );

  const slaColor =
    level === "danger"
      ? "text-red-400"
      : level === "warn"
      ? "text-yellow-400"
      : "text-green-400";

  const statusBadge = getStatusBadge(task);

  return (
    <div className="bg-zinc-800/70 border border-zinc-700 rounded-sm px-3 py-1.5 border flex flex-col gap-0.5 min-w-[480px] max-w-2xl">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-zinc-100">{task.patient.name}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-300">
          {task.patient.gender === "M" ? "男" : "女"}
          {task.patient.age}岁
        </span>
        <span className="text-zinc-500">·</span>
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-mono font-semibold border",
            EXAM_TYPE_BADGE[task.examType],
          )}
        >
          {task.examType}
        </span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-300">{task.examPart}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-zinc-500">SLA剩余:</span>
        <span className={cn("font-mono tabular-nums font-medium", slaColor)}>
          {text}
        </span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-500">状态:</span>
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[11px] font-medium",
            statusBadge.className,
          )}
        >
          {statusBadge.label}
        </span>
      </div>
    </div>
  );
}

function TopBanner() {
  const receipt = useTaskStore((s) => s.showTopBannerReceipt);
  const clearTopBanner = useTaskStore((s) => s.clearTopBanner);
  const retryWriteTask = useTaskStore((s) => s.retryWriteTask);

  if (!receipt) return null;

  if (receipt.status === "writing") {
    const progress = receipt.progress ?? 0;
    const isBatch = receipt.isBatch;
    const success = receipt.batchSuccess ?? 0;
    const failed = receipt.batchFailed ?? 0;

    return (
      <div className="bg-blue-900/70 border-b border-blue-700/60 px-4 py-2 flex items-center gap-4 shrink-0">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {isBatch ? (
            <span className="text-sm text-blue-100 truncate">
              批量写入 PACS：成功 <span className="font-semibold text-green-300">{success}</span> 例 /
              失败 <span className="font-semibold text-red-300">{failed}</span> 例
              {receipt.message && (
                <span className="text-blue-300 ml-2">· {receipt.message}</span>
              )}
            </span>
          ) : (
            <span className="text-sm text-blue-100 truncate">
              正在写入 PACS：
              <span className="font-medium ml-1">{receipt.patientName}</span>
              <span className="text-blue-300 ml-2">
                [{progress}%] {receipt.message ?? ""}
              </span>
            </span>
          )}
        </div>
        <div className="w-48 h-2 bg-blue-950/60 rounded-sm overflow-hidden shrink-0">
          <div
            className="h-full bg-blue-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (receipt.status === "success") {
    return (
      <div className="bg-green-900/70 border-b border-green-700/60 px-4 py-2 flex items-center gap-4 shrink-0">
        <div className="flex-1 text-sm text-green-100 truncate">
          ✓ 写入 PACS 成功：
          <span className="font-medium ml-1">{receipt.patientName}</span>
          {receipt.requestId && (
            <>
              <span className="ml-2 text-green-300">请求ID</span>
              <span className="font-mono ml-1 text-green-200">{receipt.requestId}</span>
            </>
          )}
          {receipt.durationSeconds !== undefined && (
            <span className="ml-2 text-green-300">
              用时 {receipt.durationSeconds}s
            </span>
          )}
        </div>
        <button
          onClick={clearTopBanner}
          className="w-7 h-7 rounded-sm flex items-center justify-center text-green-300 hover:text-green-100 hover:bg-green-800/50 transition-colors shrink-0"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-red-900/70 border-b border-red-700/60 px-4 py-2 flex items-center gap-4 shrink-0">
      <div className="flex-1 text-sm text-red-100 truncate">
        ✗ 写入 PACS 失败：
        <span className="font-medium ml-1">{receipt.patientName}</span>
        {receipt.message && (
          <span className="ml-2 text-red-300">{receipt.message}</span>
        )}
        <span className="ml-2 text-red-400">
          已自动重试 {receipt.retryCount ?? 0} 次
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => retryWriteTask(receipt.taskId)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-red-700/60 hover:bg-red-600 text-red-50 border border-red-600 text-xs font-medium transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          立即重试
        </button>
        <button
          onClick={clearTopBanner}
          className="w-7 h-7 rounded-sm flex items-center justify-center text-red-300 hover:text-red-100 hover:bg-red-800/50 transition-colors"
          title="稍后再试"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const selectTask = useTaskStore((s) => s.selectTask);
  const getFirstPendingTask = useTaskStore((s) => s.getFirstPendingTask);

  const [now, setNow] = useState<string>(formatClock());

  useEffect(() => {
    const timer = setInterval(() => setNow(formatClock()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const needAutoSelect =
      location.pathname === "/compare" ||
      location.pathname === "/confirm" ||
      location.pathname === "/batch";

    if (needAutoSelect && !selectedTaskId) {
      const first = getFirstPendingTask();
      if (first) {
        selectTask(first.taskId);
      }
    }
  }, [location.pathname, selectedTaskId, getFirstPendingTask, selectTask]);

  const selectedTask = useMemo<ExamTask | null>(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.taskId === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-medical-950 text-zinc-100 font-sans">
      <header className="h-14 flex items-center justify-between px-4 bg-zinc-900/90 border-b border-zinc-800 shrink-0 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-medical-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-base text-zinc-100 whitespace-nowrap">
              RadReview AI 回写审核工作站
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-700 mx-2" />
          <div className="flex items-center gap-1.5 text-sm text-zinc-400">
            <Hospital className="w-4 h-4" />
            <span className="whitespace-nowrap">XX 大学附属第一医院</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-w-0">
          {selectedTask ? (
            <TaskCard task={selectedTask} />
          ) : (
            <div className="px-4 py-1.5 rounded-sm bg-zinc-800/60 border border-zinc-700 text-sm text-zinc-500 max-w-xl truncate">
              请在待审列表选择任务开始审核
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span className="font-mono tabular-nums text-zinc-300">{now}</span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-medical-700 border border-medical-500 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-zinc-200">张医生</span>
              <span className="text-xs text-zinc-500">工号：DR007</span>
            </div>
          </div>
        </div>
      </header>

      <TopBanner />

      <div className="flex-1 flex overflow-hidden">
        <nav className="w-16 shrink-0 flex flex-col items-center py-4 gap-2 bg-zinc-900/60 border-r border-zinc-800">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                [
                  "w-10 h-10 rounded-sm flex items-center justify-center transition-all",
                  isActive
                    ? "bg-medical-600 text-white shadow-md shadow-medical-600/30"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80",
                ].join(" ")
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
