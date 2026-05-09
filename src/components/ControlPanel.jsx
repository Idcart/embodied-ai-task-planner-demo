import { BrainCircuit, Cpu, ImageUp, ListChecks, Play } from "lucide-react";
import { taskExamples } from "../lib/constants";
import CameraPerceptionPanel from "./CameraPerceptionPanel";
import CoordinateCalibrationPreview from "./CoordinateCalibrationPreview";
import DemoGuidePanel from "./DemoGuidePanel";

const executionModes = [
  { id: "simulation", label: "3D 仿真执行", description: "播放虚拟机器人动画" },
  { id: "dryRun", label: "实体指令预览", description: "只打印硬件指令" },
  { id: "hardware", label: "实体设备执行", description: "连接后才允许执行" }
];

export default function ControlPanel({
  task,
  setTask,
  onPerception,
  onPlan,
  onExecute,
  isBusy,
  canExecute,
  imageName,
  setImageName,
  imagePreview,
  setImagePreview,
  setImageFile,
  onImageSelected,
  worldState,
  objectCount,
  executionMode,
  setExecutionMode,
  onCameraResult,
  onUnlockScene,
  onLog,
  sceneLock,
  isFrozen,
  canUpdateWorld,
  worldSource,
  logs,
  plan,
  objects
}) {
  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setImageName("");
      setImagePreview("");
      setImageFile(null);
      onImageSelected?.(null);
      return;
    }

    setImageName(file.name);
    setImageFile(file);
    onImageSelected?.(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  return (
    <aside className="space-y-4">
      <section className="space-y-4 rounded-lg border border-line bg-white p-4 shadow-soft">
        <div>
          <h2 className="section-title">控制面板</h2>
          <p className="section-subtitle">上传场景、输入任务并启动 Agent 闭环。</p>
        </div>

        <DemoGuidePanel
          logs={logs}
          sceneLock={sceneLock}
          worldState={worldState}
          objectCount={objectCount}
          task={task}
          plan={plan}
          executionMode={executionMode}
        />

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-panel px-3 py-3 text-sm text-slate-600 transition hover:border-signal">
          <span className="flex min-w-0 items-center gap-2">
            <ImageUp size={18} aria-hidden="true" />
            <span className="truncate">{imageName || "上传场景图片，未上传时使用内置场景"}</span>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            onChange={handleImageChange}
          />
        </label>

        {imagePreview ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <img src={imagePreview} alt="已上传的场景预览" className="max-h-40 w-full object-contain" />
          </div>
        ) : null}

        <button className="primary-button w-full" onClick={onPerception} disabled={isBusy}>
          <BrainCircuit size={18} aria-hidden="true" />
          {objectCount ? "重新识别场景" : "识别场景"}
        </button>

        <details className="group rounded-lg border border-line bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-ink">
            <span>摄像头感知测试</span>
            <span className="text-xs text-slate-500 transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="border-t border-line p-3">
            <CameraPerceptionPanel
              onLog={onLog}
              onPerceptionResult={onCameraResult}
              onUnlockScene={onUnlockScene}
              sceneLock={sceneLock}
              isFrozen={isFrozen}
              canUpdateWorld={canUpdateWorld}
              worldSource={worldSource}
            />
          </div>
        </details>

        <textarea
          className="min-h-28 w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm text-ink outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal/20"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder="例如：把杯子移动到桌子右上角"
        />

        <select
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal/20"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) setTask(event.target.value);
          }}
        >
          <option value="">选择推荐任务指令</option>
          {taskExamples.map((example) => (
            <option key={example} value={example}>
              {example}
            </option>
          ))}
        </select>

        <div className="space-y-2 rounded-lg border border-line bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Cpu size={17} aria-hidden="true" />
            执行模式
          </div>
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/20"
            value={executionMode}
            onChange={(event) => setExecutionMode(event.target.value)}
          >
            {executionModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {executionModes.find((mode) => mode.id === executionMode)?.description}
          </p>
          <CoordinateCalibrationPreview objects={objects} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="secondary-button" onClick={onPlan} disabled={isBusy}>
            <ListChecks size={18} aria-hidden="true" />
            生成计划
          </button>
          <button className="accent-button" onClick={onExecute} disabled={!canExecute || isBusy}>
            <Play size={18} aria-hidden="true" />
            开始执行
          </button>
        </div>
      </section>
    </aside>
  );
}
