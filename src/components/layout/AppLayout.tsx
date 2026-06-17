import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import {
  ListTodo,
  Images,
  FileDiff,
  Layers,
  Settings,
  User,
  Clock,
  Hospital,
} from "lucide-react";

const navItems = [
  { to: "/tasks", icon: ListTodo, label: "任务列表" },
  { to: "/compare", icon: Images, label: "影像对比" },
  { to: "/confirm", icon: FileDiff, label: "差异确认" },
  { to: "/batch", icon: Layers, label: "批量处理" },
  { to: "/preferences", icon: Settings, label: "偏好设置" },
];

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AppLayout() {
  const [now, setNow] = useState<string>(formatNow());

  useEffect(() => {
    const timer = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-medical-950 text-zinc-100 font-sans">
      {/* 顶部状态栏 */}
      <header className="h-14 flex items-center justify-between px-4 bg-zinc-900/90 border-b border-zinc-800 shrink-0">
        {/* 左侧：Logo + 医院名称 */}
        <div className="flex items-center gap-3">
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
            <span className="whitespace-nowrap">XX 大学附属医院 · 放射科</span>
          </div>
        </div>

        {/* 中间：当前选中任务简要信息 */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="px-4 py-1.5 rounded-sm bg-zinc-800/60 border border-zinc-700 text-sm text-zinc-300 max-w-xl truncate">
            <span className="text-zinc-500 mr-2">当前任务：</span>
            <span className="text-zinc-100">暂无选中任务</span>
          </div>
        </div>

        {/* 右侧：用户 + 时间 */}
        <div className="flex items-center gap-4">
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
              <span className="text-xs text-zinc-500">工号：RAD-00128</span>
            </div>
          </div>
        </div>
      </header>

      {/* 主体区域：左侧导航 + 主内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航 */}
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

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
