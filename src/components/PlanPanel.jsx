import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { actionLabels } from "../lib/constants";

function StepIcon({ status }) {
  if (status === "completed") return <CheckCircle2 size={18} className="text-teal-600" aria-hidden="true" />;
  if (status === "running") return <Loader2 size={18} className="animate-spin text-amber" aria-hidden="true" />;
  return <Clock3 size={18} className="text-slate-400" aria-hidden="true" />;
}

export default function PlanPanel({ intent, understanding, failure, plan, currentStep }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3">
        <h2 className="section-title">AI 规划步骤区</h2>
        <p className="section-subtitle">任务被拆解成可执行的机器人动作。</p>
      </div>

      {intent ? (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-panel p-3 text-xs">
          <div>
            <p className="text-slate-400">目标对象</p>
            <p className="mt-1 font-medium text-ink">{intent.targetName}</p>
          </div>
          <div>
            <p className="text-slate-400">动作类型</p>
            <p className="mt-1 font-medium text-ink">{intent.actionType}</p>
          </div>
          <div>
            <p className="text-slate-400">目标位置</p>
            <p className="mt-1 font-medium text-ink">{intent.destination}</p>
          </div>
        </div>
      ) : null}

      {understanding ? (
        <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-slate-400">前置条件</p>
              <ul className="mt-1 space-y-1 text-slate-700">
                {understanding.preconditions.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-slate-400">风险提示</p>
              <ul className="mt-1 space-y-1 text-slate-700">
                {understanding.risks.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {failure ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">任务无法执行：{failure.reason}</p>
          <p className="mt-1">{failure.suggestion}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        {plan.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-panel px-3 py-8 text-center text-sm text-slate-500">
            点击“生成计划”后显示执行步骤
          </div>
        ) : (
          plan.map((step) => {
            const isCurrent = currentStep === step.step;
            return (
              <div
                key={step.step}
                className={`flex gap-3 rounded-lg border p-3 transition ${
                  isCurrent
                    ? "border-amber bg-amber-50"
                    : step.status === "completed"
                      ? "border-teal-200 bg-teal-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <StepIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">Step {step.step}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {actionLabels[step.action] || step.action}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
