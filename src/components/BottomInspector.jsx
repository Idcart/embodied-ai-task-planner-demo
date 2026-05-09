import { useState } from "react";
import LogPanel from "./LogPanel";
import PerceptionPanel from "./PerceptionPanel";
import PlanPanel from "./PlanPanel";
import WorldStatePanel from "./WorldStatePanel";

const tabs = [
  { id: "plan", label: "AI 规划步骤" },
  { id: "objects", label: "识别物体列表" },
  { id: "worldState", label: "World State" },
  { id: "logs", label: "执行日志" }
];

export default function BottomInspector({
  intent,
  understanding,
  failure,
  plan,
  currentStep,
  worldState,
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
      <div className="mb-3 rounded-lg border border-slate-200 bg-panel p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
              activeTab === tab.id ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-white"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {activeTab === tab.id ? <span className="text-xs opacity-80">当前</span> : null}
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
        {activeTab === "worldState" ? <WorldStatePanel worldState={worldState} objectCount={objects.length} /> : null}
        {activeTab === "logs" ? <LogPanel logs={logs} result={result} /> : null}
      </div>
    </section>
  );
}
