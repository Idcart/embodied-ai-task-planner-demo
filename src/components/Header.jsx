import { Bot, Cpu, Radar } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-white shadow-soft">
            <Bot size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-ink">
              Embodied AI Task Planner Demo
            </h1>
            <p className="text-sm text-slate-500">感知 → 理解 → 规划 → 执行</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
          <Radar size={18} aria-hidden="true" />
          <span>Mock Vision</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <Cpu size={18} aria-hidden="true" />
          <span>Rule Planner</span>
        </div>
      </div>
    </header>
  );
}
