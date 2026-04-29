import { flowStages } from "../lib/constants";

export default function FlowDiagram({ activeStage }) {
  const activeIndex = flowStages.findIndex((stage) => stage.id === activeStage);

  return (
    <section className="rounded-lg border border-line bg-white px-4 py-3 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="section-title">具身智能流程图</h2>
          <p className="section-subtitle">当前阶段会随操作流程自动高亮。</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {flowStages.map((stage, index) => {
          const isActive = stage.id === activeStage;
          const isDone = activeIndex > index;

          return (
            <div key={stage.id} className="flex min-w-0 items-center gap-2">
              <div
                className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-amber bg-amber-50 text-amber-700"
                    : isDone
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : "border-slate-200 bg-panel text-slate-500"
                }`}
              >
                {stage.label}
              </div>
              {index < flowStages.length - 1 ? <span className="hidden text-slate-300 sm:block">→</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
