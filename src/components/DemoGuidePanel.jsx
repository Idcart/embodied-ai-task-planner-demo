import { ChevronDown, CheckCircle2, Circle } from "lucide-react";
import { useMemo, useState } from "react";

function hasLog(logs = [], matcher) {
  return logs.some((log) => matcher(`${log.type || ""} ${log.message || ""}`));
}

export default function DemoGuidePanel({
  logs = [],
  sceneLock,
  worldState,
  objectCount = 0,
  task = "",
  plan = [],
  executionMode = "simulation"
}) {
  const [open, setOpen] = useState(false);

  const steps = useMemo(() => {
    const completedPlanSteps = plan.filter((step) => step.status === "completed").length;
    const lastResult = worldState?.lastExecutionResult || {};
    const normalizedTask = task.trim();

    return [
      {
        label: "开启摄像头",
        done: hasLog(logs, (text) => text.includes("摄像头已开启") || text.includes("已开启摄像头"))
      },
      {
        label: "点击“感知当前场景”",
        done: hasLog(logs, (text) => text.includes("开始感知当前场景"))
      },
      {
        label: "系统识别桌面物体",
        done: objectCount > 0 || hasLog(logs, (text) => text.includes("识别成功，发现"))
      },
      {
        label: "锁定当前场景",
        done: Boolean(sceneLock?.locked)
      },
      {
        label: "3D 空间生成物体",
        done: Boolean(worldState?.objects?.length)
      },
      {
        label: "输入任务：把杯子移动到右上角",
        done: normalizedTask.includes("杯") && normalizedTask.includes("右上")
      },
      {
        label: "生成计划",
        done: plan.length > 0
      },
      {
        label: "选择 3D 仿真执行",
        done: executionMode === "simulation"
      },
      {
        label: "机器人移动、抓取、放置",
        done:
          completedPlanSteps > 0 &&
          (hasLog(logs, (text) => text.includes("已抓取")) || hasLog(logs, (text) => text.includes("已放下")))
      },
      {
        label: "系统验证结果",
        done: lastResult.status === "completed" || hasLog(logs, (text) => text.includes("验证") && text.includes("成功"))
      },
      {
        label: "切换 Dry Run，展示实体机器人指令预览",
        done: lastResult.status === "dry_run_completed" || hasLog(logs, (text) => text.includes("[DryRun]"))
      },
      {
        label: "Hardware 模式提示当前未连接实体设备",
        done: hasLog(logs, (text) => text.includes("当前未连接实体设备"))
      }
    ];
  }, [executionMode, logs, objectCount, plan, sceneLock?.locked, task, worldState]);

  const doneCount = steps.filter((step) => step.done).length;

  return (
    <div className="rounded-lg border border-line bg-slate-50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>
          <span className="block text-sm font-semibold text-ink">演示流程</span>
          <span className="mt-1 block text-xs text-slate-500">
            {doneCount}/{steps.length} 步完成，仅做操作引导
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-line px-3 py-3">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-start gap-2 text-xs">
              {step.done ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-teal-600" aria-hidden="true" />
              ) : (
                <Circle size={15} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
              )}
              <span className={step.done ? "font-medium text-ink" : "text-slate-500"}>
                {index + 1}. {step.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
