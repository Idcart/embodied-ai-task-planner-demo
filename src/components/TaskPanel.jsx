import { BrainCircuit, ImageUp, ListChecks, Play } from "lucide-react";
import { taskExamples } from "../lib/constants";

export default function TaskPanel({
  task,
  setTask,
  onPerception,
  onPlan,
  onExecute,
  isBusy,
  canPlan,
  canExecute,
  imageName,
  setImageName,
  imagePreview,
  setImagePreview,
  setImageFile,
  onImageSelected
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
    <section className="space-y-4 rounded-lg border border-line bg-white p-4 shadow-soft">
      <div>
        <h2 className="section-title">任务输入区</h2>
        <p className="section-subtitle">输入自然语言任务，或选择一个教学示例。</p>
      </div>

      <textarea
        className="min-h-24 w-full resize-none rounded-lg border border-line bg-slate-50 px-3 py-3 text-sm text-ink outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal/20"
        value={task}
        onChange={(event) => setTask(event.target.value)}
        placeholder="例如：把杯子移动到桌子右上角"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {taskExamples.map((example) => (
          <button
            key={example}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-left text-sm text-slate-700 transition hover:border-signal hover:bg-teal-50"
            onClick={() => setTask(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-panel px-3 py-3 text-sm text-slate-600 transition hover:border-signal">
        <span className="flex min-w-0 items-center gap-2">
          <ImageUp size={18} aria-hidden="true" />
          <span className="truncate">{imageName || "上传场景图片，当前 Demo 使用 mock 识别结果"}</span>
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
          <img src={imagePreview} alt="已上传的场景预览" className="max-h-44 w-full object-contain" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button className="primary-button" onClick={onPerception} disabled={isBusy}>
          <BrainCircuit size={18} aria-hidden="true" />
          识别场景
        </button>
        <button className="secondary-button" onClick={onPlan} disabled={!canPlan || isBusy}>
          <ListChecks size={18} aria-hidden="true" />
          生成计划
        </button>
        <button className="accent-button" onClick={onExecute} disabled={!canExecute || isBusy}>
          <Play size={18} aria-hidden="true" />
          开始执行
        </button>
      </div>
    </section>
  );
}
