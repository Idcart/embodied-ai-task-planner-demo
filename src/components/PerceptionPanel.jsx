import { Eye, LocateFixed } from "lucide-react";

const imageCanvas = { width: 600, height: 400 };

function getBoxStyle(object) {
  if (object.bbox) {
    return {
      left: `${object.bbox.x}%`,
      top: `${object.bbox.y}%`,
      width: `${object.bbox.width}%`,
      height: `${object.bbox.height}%`
    };
  }

  const boxWidth = object.type === "book" ? 22 : object.type === "pen" ? 18 : 14;
  const boxHeight = object.type === "book" ? 13 : object.type === "pen" ? 8 : 14;
  const xPercent =
    typeof object.position?.xPercent === "number"
      ? object.position.xPercent
      : ((object.scenePosition?.x ?? object.position?.x ?? imageCanvas.width / 2) / imageCanvas.width) * 100;
  const yPercent =
    typeof object.position?.yPercent === "number"
      ? object.position.yPercent
      : ((object.scenePosition?.y ?? object.position?.y ?? imageCanvas.height / 2) / imageCanvas.height) * 100;
  const left = xPercent - boxWidth / 2;
  const top = yPercent - boxHeight / 2;

  return {
    left: `${Math.max(1, Math.min(96 - boxWidth, left))}%`,
    top: `${Math.max(1, Math.min(96 - boxHeight, top))}%`,
    width: `${boxWidth}%`,
    height: `${boxHeight}%`
  };
}

function getDisplayPosition(object) {
  if (typeof object.position?.xPercent === "number" && typeof object.position?.yPercent === "number") {
    return `${object.position.region} · x: ${object.position.xPercent}%, y: ${object.position.yPercent}%`;
  }

  return `x: ${object.position?.x ?? object.scenePosition?.x ?? "-"}, y: ${object.position?.y ?? object.scenePosition?.y ?? "-"}`;
}

export default function PerceptionPanel({ objects, summary, sceneDescription, imagePreview }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="section-title">感知 Perception</h2>
          <p className="section-subtitle">{summary || "等待场景识别结果。"}</p>
        </div>
        <Eye size={20} className="text-signal" aria-hidden="true" />
      </div>

      {sceneDescription ? (
        <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {sceneDescription}
        </div>
      ) : null}

      <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <div className="relative aspect-[4/3] w-full">
          {imagePreview ? (
            <img src={imagePreview} alt="上传的场景" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(90deg,rgba(148,163,184,.22)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.22)_1px,transparent_1px)] bg-[length:28px_28px] text-sm text-slate-500">
              内置桌面场景
            </div>
          )}

          {objects.map((object) => (
            <div
              key={object.id}
              className="absolute rounded border-2 border-teal-400 bg-teal-400/10 shadow-[0_0_0_1px_rgba(15,23,42,.18)]"
              style={getBoxStyle(object)}
            >
              <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[11px] font-medium text-white">
                {object.name} {Math.round((object.confidence || 0) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {objects.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-panel px-3 py-6 text-center text-sm text-slate-500">
            识别到的物体会显示在这里
          </div>
        ) : (
          objects.map((object) => (
            <div key={object.id} className="rounded-lg border border-slate-200 bg-panel p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">{object.name}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{object.type}</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <LocateFixed size={14} aria-hidden="true" />
                {getDisplayPosition(object)} · conf: {Math.round((object.confidence || 0) * 100)}%
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${object.operable ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                  {object.operable ? "可操作" : "不建议操作"}
                </span>
                <span className="truncate text-slate-500">{object.description}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                {(object.affordance || []).map((item) => (
                  <span key={item} className="rounded-full bg-white px-2 py-0.5 text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
              {object.risk ? <p className="mt-2 text-xs text-amber-700">风险：{object.risk}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
