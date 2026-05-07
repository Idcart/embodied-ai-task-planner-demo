import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, LockOpen, RefreshCw, ScanEye } from "lucide-react";
import { runLiveFramePerception } from "../lib/api";

const intervalOptions = [1000, 3000, 5000];
const perceptionModes = [
  { id: "manual", label: "手动感知" },
  { id: "observe", label: "观察模式" },
  { id: "auto", label: "自动更新" }
];

function statusLabel(status) {
  if (status === "ready") return "摄像头已开启";
  if (status === "recognizing") return "正在识别";
  if (status === "observing") return "观察模式中";
  if (status === "error") return "识别失败";
  return "摄像头未开启";
}

function confidenceText(value) {
  if (typeof value !== "number") return "--";
  return `${Math.round(value * 100)}%`;
}

export default function CameraPerceptionPanel({
  onLog,
  onPerceptionResult,
  onUnlockScene,
  sceneLock,
  isFrozen = false,
  canUpdateWorld = true,
  worldSource = "未设置"
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const recognizingRef = useRef(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [mode, setMode] = useState("manual");
  const [allowObserveUpdate, setAllowObserveUpdate] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const isCameraOn = Boolean(streamRef.current);
  const isObserving = Boolean(timerRef.current);

  const stopObserveMode = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      setStatus("ready");
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopObserveMode();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recognizingRef.current = false;
    setIsRecognizing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
    setError("");
  }, [stopObserveMode]);

  useEffect(() => {
    return () => closeCamera();
  }, [closeCamera]);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "当前浏览器不支持摄像头访问，请使用 localhost 或 HTTPS 下的现代浏览器。";
      setError(message);
      setStatus("error");
      onLog?.("错误", message);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("ready");
      onLog?.("摄像头", "摄像头已开启，仅实时预览，不自动识别");
    } catch (cameraError) {
      const message = cameraError?.name === "NotAllowedError" ? "摄像头权限被拒绝" : `摄像头开启失败：${cameraError.message}`;
      setError(message);
      setStatus("error");
      onLog?.("错误", message);
    }
  }

  function captureVideoFrame() {
    const video = videoRef.current;
    if (!video || !streamRef.current || !video.videoWidth || !video.videoHeight) {
      throw new Error("摄像头画面尚未准备好");
    }

    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("视频帧压缩失败"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.75
      );
    });
  }

  const recognizeFrame = useCallback(async ({ updateWorld = false, lockScene = false, reason = "manual" } = {}) => {
    if (recognizingRef.current) return;
    if (!streamRef.current) {
      setError("请先开启摄像头");
      return;
    }

    recognizingRef.current = true;
    setIsRecognizing(true);
    setStatus(timerRef.current ? "observing" : "recognizing");
    setError("");
    onLog?.("感知", reason === "manual" ? "开始感知当前场景" : "开始截取当前视频帧");

    try {
      const blob = await captureVideoFrame();
      onLog?.("感知", "正在调用实时识别接口");
      const data = await runLiveFramePerception(blob);
      const detectedObjects = data.objects || [];
      setLastResult(data);
      onLog?.("感知", `识别成功，发现 ${detectedObjects.length} 个物体`);

      if (updateWorld) {
        if (!canUpdateWorld || isFrozen) {
          onLog?.("感知", "当前任务执行中，本次识别仅作为预览，未覆盖 worldState。");
        } else if (sceneLock?.locked && !lockScene) {
          onLog?.("观察", "当前场景已锁定，本次识别仅更新预览，不覆盖 3D 空间");
        } else {
          onPerceptionResult?.(data, {
            lockScene,
            source: data.mode === "mock" ? "摄像头 mock" : "摄像头单帧",
            confirmed: reason === "reperceive"
          });
        }
      } else {
        onLog?.("观察", "本次识别仅更新预览，不覆盖 3D 空间");
      }

      setStatus(timerRef.current ? "observing" : "ready");
    } catch (recognitionError) {
      const message = `实时识别失败：${recognitionError.message}`;
      setError(message);
      setStatus("error");
      onLog?.("错误", message);
    } finally {
      recognizingRef.current = false;
      setIsRecognizing(false);
    }
  }, [canUpdateWorld, isFrozen, onLog, onPerceptionResult, sceneLock?.locked]);

  function perceiveCurrentScene() {
    if (sceneLock?.locked) {
      setError("当前场景已锁定，如需覆盖请点击重新感知场景。");
      return;
    }
    recognizeFrame({ updateWorld: true, lockScene: true, reason: "reperceive" });
  }

  function rePerceiveScene() {
    if (isFrozen || !canUpdateWorld) {
      const message = "当前任务执行中，不能覆盖场景状态。";
      setError(message);
      onLog?.("场景", "当前任务执行中，禁止覆盖 worldState");
      return;
    }

    onLog?.("场景", "重新感知会覆盖当前 worldState");
    if (!window.confirm("重新感知会覆盖当前 3D 场景状态，是否继续？")) return;
    recognizeFrame({ updateWorld: true, lockScene: true, reason: "manual" });
  }

  function startObserveMode() {
    if (!streamRef.current) {
      setError("请先开启摄像头");
      return;
    }
    stopObserveMode();
    setMode(mode === "auto" ? "auto" : "observe");
    setStatus("observing");
    recognizeFrame({
      updateWorld: mode === "auto" && allowObserveUpdate && !sceneLock?.locked && canUpdateWorld && !isFrozen,
      lockScene: false,
      reason: "observe"
    });
    timerRef.current = setInterval(() => {
      if (!recognizingRef.current) {
        const canAutoUpdate = mode === "auto" && allowObserveUpdate && !sceneLock?.locked && canUpdateWorld && !isFrozen;
        recognizeFrame({ updateWorld: canAutoUpdate, lockScene: false, reason: "observe" });
      }
    }, intervalMs);
  }

  const updateAllowedText = canUpdateWorld && !isFrozen && !sceneLock?.locked ? "允许" : "禁止";

  return (
    <div className="space-y-3 rounded-lg border border-line bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Camera size={17} aria-hidden="true" />
            摄像头感知测试
          </div>
          <p className="mt-1 text-xs text-slate-500">摄像头只实时预览，点击后才感知当前场景。</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === "error" ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <video ref={videoRef} muted playsInline className="h-36 w-full object-cover" />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-white p-2 text-xs text-slate-600">
        <div>摄像头：<span className="font-semibold text-ink">{isCameraOn ? "已开启" : "未开启"}</span></div>
        <div>感知模式：<span className="font-semibold text-ink">{perceptionModes.find((item) => item.id === mode)?.label}</span></div>
        <div>场景状态：<span className="font-semibold text-ink">{sceneLock?.locked ? "已锁定" : "未锁定"}</span></div>
        <div>允许更新：<span className="font-semibold text-ink">{updateAllowedText}</span></div>
        <div className="col-span-2">锁定时间：<span className="font-semibold text-ink">{sceneLock?.lockedAt || "--"}</span></div>
        <div className="col-span-2">worldState 来源：<span className="font-semibold text-ink">{worldSource}</span></div>
      </div>

      {sceneLock?.locked ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
          当前场景已锁定，可以开始下达任务
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {perceptionModes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
              mode === item.id ? "border-signal bg-teal-50 text-ink" : "border-line bg-white text-slate-600 hover:border-signal"
            }`}
            onClick={() => {
              setMode(item.id);
              if (item.id === "manual") stopObserveMode();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="secondary-button" type="button" onClick={openCamera} disabled={isCameraOn}>
          <Camera size={16} aria-hidden="true" />
          开启摄像头
        </button>
        <button className="secondary-button" type="button" onClick={closeCamera} disabled={!isCameraOn}>
          <CameraOff size={16} aria-hidden="true" />
          关闭摄像头
        </button>
        <button className="accent-button" type="button" onClick={perceiveCurrentScene} disabled={!isCameraOn || isRecognizing || sceneLock?.locked}>
          <ScanEye size={16} aria-hidden="true" />
          感知当前场景
        </button>
        <button className="secondary-button" type="button" onClick={rePerceiveScene} disabled={!isCameraOn || isRecognizing}>
          <RefreshCw size={16} aria-hidden="true" />
          重新感知场景
        </button>
        <button className="secondary-button" type="button" onClick={onUnlockScene} disabled={!sceneLock?.locked}>
          <LockOpen size={16} aria-hidden="true" />
          解锁场景
        </button>
        <button
          className={isObserving ? "secondary-button" : "secondary-button"}
          type="button"
          onClick={isObserving ? stopObserveMode : startObserveMode}
          disabled={!isCameraOn}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {isObserving ? "停止观察模式" : "开始观察模式"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1 text-slate-600">
          <span className="font-semibold text-ink">识别间隔</span>
          <select
            className="h-9 w-full rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-signal"
            value={intervalMs}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
          >
            {intervalOptions.map((value) => (
              <option key={value} value={value}>
                {value}ms
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-2 py-2 text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-600"
            checked={allowObserveUpdate}
            onChange={(event) => setAllowObserveUpdate(event.target.checked)}
          />
          允许观察模式更新 worldState
        </label>
      </div>

      {isRecognizing ? <p className="text-xs font-semibold text-signal">正在识别当前画面...</p> : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}

      {lastResult ? (
        <div className="space-y-2 rounded-lg border border-line bg-white p-3">
          <p className="text-xs font-semibold text-ink">最新识别结果</p>
          <p className="line-clamp-2 text-xs text-slate-500">{lastResult.sceneDescription || "暂无场景描述"}</p>
          <div className="max-h-44 space-y-2 overflow-auto pr-1">
            {(lastResult.objects || []).map((object) => (
              <div key={object.id} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{object.name}</span>
                  <span className="text-slate-500">{confidenceText(object.confidence)}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {object.type} · {object.position?.region || "未知区域"} · {object.operable ? "可操作" : "不可操作"}
                </p>
                <p className="mt-1 text-slate-500">能力：{object.affordance?.join("、") || "未知"}</p>
                <p className="mt-1 text-slate-500">风险：{object.risk || "未给出"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
