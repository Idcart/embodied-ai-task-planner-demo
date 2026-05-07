import { ChevronDown, Crosshair } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calibrationConfig,
  imageToVirtual3D,
  virtual3DToRobotCoord
} from "../utils/coordinateTransform";

function formatNumber(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function getObjectImagePosition(object) {
  const position = object?.position || {};
  return {
    xPercent: Number(position.xPercent ?? 50),
    yPercent: Number(position.yPercent ?? 50),
    region: position.region || "未知区域"
  };
}

export default function CoordinateCalibrationPreview({ objects = [] }) {
  const [open, setOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState("");

  const selectedObject = useMemo(() => {
    return objects.find((object) => object.id === selectedObjectId) || objects[0] || null;
  }, [objects, selectedObjectId]);

  const preview = useMemo(() => {
    if (!selectedObject) return null;
    const imagePosition = getObjectImagePosition(selectedObject);
    const virtualPosition = imageToVirtual3D(imagePosition.xPercent, imagePosition.yPercent);
    const robotPosition = virtual3DToRobotCoord(virtualPosition, calibrationConfig);

    return {
      imagePosition,
      virtualPosition,
      robotPosition
    };
  }, [selectedObject]);

  return (
    <div className="rounded-lg border border-line bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Crosshair size={16} className="shrink-0 text-signal" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink">坐标校准预览</span>
            <span className="mt-1 block text-xs text-slate-500">只预览坐标转换，不控制硬件</span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-line px-3 py-3">
          {objects.length ? (
            <>
              <label className="block space-y-1 text-xs text-slate-600">
                <span className="font-semibold text-ink">选中物体</span>
                <select
                  className="h-9 w-full rounded-lg border border-line bg-slate-50 px-2 text-sm text-ink outline-none focus:border-signal"
                  value={selectedObject?.id || ""}
                  onChange={(event) => setSelectedObjectId(event.target.value)}
                >
                  {objects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name} / {object.type}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="font-semibold text-ink">图像坐标</p>
                  <p className="mt-1 text-slate-600">
                    xPercent={formatNumber(preview.imagePosition.xPercent)}，
                    yPercent={formatNumber(preview.imagePosition.yPercent)}
                  </p>
                  <p className="mt-1 text-slate-500">region={preview.imagePosition.region}</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="font-semibold text-ink">3D 虚拟坐标</p>
                  <p className="mt-1 text-slate-600">
                    x={formatNumber(preview.virtualPosition.x)}，
                    y={formatNumber(preview.virtualPosition.y)}，
                    z={formatNumber(preview.virtualPosition.z)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="font-semibold text-ink">机器人坐标</p>
                  <p className="mt-1 text-slate-600">
                    x={formatNumber(preview.robotPosition.x, 3)}m，
                    y={formatNumber(preview.robotPosition.y, 3)}m，
                    z={formatNumber(preview.robotPosition.z, 3)}m
                  </p>
                  <p className="mt-1 text-slate-500">unit={preview.robotPosition.unit}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
              暂无可预览物体，请先完成图片或摄像头感知。
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
