import { useState } from "react";
import LogPanel from "./LogPanel";
import PerceptionPanel from "./PerceptionPanel";
import PlanPanel from "./PlanPanel";

const tabs = [
  { id: "plan", label: "AI 规划步骤" },
  { id: "objects", label: "识别物体列表" },
  { id: "logs", label: "执行日志" }
];

export default function BottomInspector({
  intent,
  understanding,
  failure,
  plan,
  currentStep,
  objects,
  summary,
  sceneDescription,
  imagePreview,
  logs,
  result
}) {
  const [activeTab, setActiveTab] = useState("plan");

  return (
    <section className="rounded-lg border border-line bg-white p-3 shadow-soft">
      <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.id ? "bg-ink text-white" : "bg-panel text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[260px]">
        {activeTab === "plan" ? (
          <PlanPanel
            intent={intent}
            understanding={understanding}
            failure={failure}
            plan={plan}
            currentStep={currentStep}
          />
        ) : null}
        {activeTab === "objects" ? (
          <PerceptionPanel
            objects={objects}
            summary={summary}
            sceneDescription={sceneDescription}
            imagePreview={imagePreview}
          />
        ) : null}
        {activeTab === "logs" ? <LogPanel logs={logs} result={result} /> : null}
      </div>
    </section>
  );
}
