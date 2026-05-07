import { Bot, Cpu, Radar } from "lucide-react";
import { flowStages } from "../lib/constants";

export default function Header({ statusSummary, activeStage }) {
  const stageLabel = flowStages.find((stage) => stage.id === activeStage)?.label || "待机";

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
            <p className="text-sm text-slate-500">具身智能 Agent 控制台</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-700">{stageLabel}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{statusSummary || "等待规划"}</span>
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
