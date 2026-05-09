import { useMemo, useRef, useState } from "react";
import BottomInspector from "./components/BottomInspector";
import ControlPanel from "./components/ControlPanel";
import Header from "./components/Header";
import EmbodiedWorld3D from "./components/EmbodiedWorld3D";
import ProcessStepper from "./components/ProcessStepper";
import {
  executeHardwarePlan,
  executeHardwareStep,
  executePlan,
  generatePlan,
  getHardwareStatus,
  runPerception
} from "./lib/api";
import DryRunExecutor from "./executors/DryRunExecutor";
import HardwareExecutor from "./executors/HardwareExecutor";
import SimulationExecutor from "./executors/SimulationExecutor";
import { initialRobot } from "./lib/constants";
import {
  emptyWorldState,
  getMovedObjectsFromWorldState,
  getRegionFromWorld,
  getTargetRegion,
  initializeWorldState,
  isObjectInTargetRegion,
  mergeObjectsWithWorldState,
  robotSceneToWorld,
  robotWorldToScene,
  scenePointToWorld
} from "./lib/worldState";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createLog(type, message) {
  return {
    type,
    message,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false })
  };
}

function statusText(status) {
  if (status === "completed") return "已完成";
  if (status === "running") return "执行中";
  return "等待中";
}

function getTargetFromPlan(plan, intent) {
  const targetStep = plan.find((step) => step.targetPosition || ["check_target_area", "move_to_target", "place_object", "verify_result"].includes(step.action));
  const position = targetStep?.targetPosition || targetStep?.position || intent?.destinationPosition || null;
  const region = getTargetRegion(targetStep?.targetArea || intent?.destination || "", position);
  return {
    position,
    region,
    label: targetStep?.targetArea || intent?.destination || "目标区域"
  };
}

function normalizeCameraObjectId(object, index) {
  const type = String(object.type || "object").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return object.id?.startsWith("camera_") ? object.id : `camera_${type}_${index + 1}`;
}

function normalizeCameraObjects(detectedObjects = [], existingObjects = []) {
  return detectedObjects.map((object, index) => {
    const sameObject = existingObjects.find(
      (item) =>
        item.id === object.id ||
        (item.name && object.name && item.name === object.name) ||
        (item.type && object.type && item.type === object.type)
    );

    return {
      ...object,
      id: sameObject?.id || normalizeCameraObjectId(object, index),
      source: "camera"
    };
  });
}

export default function App() {
  const [task, setTask] = useState("把杯子移动到桌子右上角");
  const [imageName, setImageName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [objects, setObjects] = useState([]);
  const [perceptionSummary, setPerceptionSummary] = useState("");
  const [sceneDescription, setSceneDescription] = useState("");
  const [intent, setIntent] = useState(null);
  const [understanding, setUnderstanding] = useState(null);
  const [failure, setFailure] = useState(null);
  const [executable, setExecutable] = useState(true);
  const [plan, setPlan] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [robot, setRobot] = useState(initialRobot);
  const [activeObjectId, setActiveObjectId] = useState(null);
  const [heldObjectId, setHeldObjectId] = useState(null);
  const [movedObjects, setMovedObjects] = useState({});
  const [robotPath, setRobotPath] = useState([initialRobot]);
  const [worldState, setWorldState] = useState(emptyWorldState);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeStage, setActiveStage] = useState("perception");
  const [executionMode, setExecutionMode] = useState("simulation");
  const [sceneLock, setSceneLock] = useState({
    locked: false,
    lockedAt: null,
    source: null,
    description: "",
    objectCount: 0
  });
  const executionToken = useRef(0);
  const worldStateRef = useRef(emptyWorldState);

  const canExecute = plan.length > 0;
  const sceneObjects = useMemo(() => mergeObjectsWithWorldState(objects, worldState), [objects, worldState]);

  const statusSummary = useMemo(() => {
    const completed = plan.filter((step) => step.status === "completed").length;
    return plan.length ? `${completed}/${plan.length} 步完成` : "等待规划";
  }, [plan]);

  const targetAreaPosition = useMemo(() => {
    return getTargetFromPlan(plan, intent).position;
  }, [intent, plan]);

  const isWorldUpdateFrozen = isBusy && ["understanding", "planning", "execution", "verification"].includes(activeStage);
  const worldSource = sceneLock.source || worldState.lastExecutionResult?.source || "未设置";

  function addLog(type, message) {
    setLogs((prev) => [...prev, createLog(type, message)]);
  }

  function addWorldStateLog(message, state = worldStateRef.current) {
    const robotPosition = state.robot?.position || emptyWorldState.robot.position;
    const holdingObject = state.robot?.holdingObjectId || "无";
    addLog(
      "状态",
      `${message}；robot=(${robotPosition.x.toFixed(2)}, ${robotPosition.z.toFixed(2)})；holding=${holdingObject}；objects=${state.objects?.length || 0}`
    );
  }

  function updateWorldState(updater) {
    const next = typeof updater === "function" ? updater(worldStateRef.current) : updater;
    worldStateRef.current = next;
    setWorldState(next);
    setMovedObjects(getMovedObjectsFromWorldState(next));
    return next;
  }

  function lockScene({ source, description, objectCount }) {
    const lockedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setSceneLock({
      locked: true,
      lockedAt,
      source,
      description,
      objectCount
    });
    addLog("场景", "当前场景已锁定");
    addLog("锁定", "当前场景已锁定，可以开始下达任务");
  }

  function unlockScene() {
    setSceneLock((prev) => ({
      ...prev,
      locked: false,
      lockedAt: null
    }));
    addLog("锁定", "当前场景已解锁，可以重新感知。");
  }

  function shouldAllowWorldStateOverwrite(sourceLabel) {
    if (isWorldUpdateFrozen) {
      addLog("场景", "当前任务执行中，禁止覆盖 worldState");
      addWorldStateLog(`${sourceLabel}覆盖被阻止`);
      return false;
    }

    if (worldStateRef.current.objects.length || sceneLock.locked) {
      addLog("场景", `${sourceLabel}会覆盖当前 worldState`);
      return window.confirm(`${sourceLabel}会覆盖当前 3D 场景状态，是否继续？`);
    }

    return true;
  }

  function syncCameraPerceptionToWorld(data, options = {}) {
    if (isWorldUpdateFrozen) {
      addLog("场景", "当前任务执行中，禁止覆盖 worldState");
      addWorldStateLog("摄像头感知覆盖被阻止");
      return;
    }

    const detectedObjects = normalizeCameraObjects(data.objects || [], objects);
    if (!detectedObjects.length) {
      addLog("错误", "摄像头实时感知未识别到可映射物体");
      return;
    }

    if (options.lockScene && !options.confirmed && worldStateRef.current.objects.length) {
      addLog("场景", "摄像头感知会覆盖当前 worldState");
      if (!window.confirm("摄像头感知会覆盖当前 3D 场景状态，是否继续？")) {
        addWorldStateLog("摄像头感知覆盖已取消");
        return;
      }
    }

    setObjects(detectedObjects);
    setPerceptionSummary(`摄像头实时识别到 ${detectedObjects.length} 个物体`);
    setSceneDescription(data.sceneDescription || "");
    setPlan([]);
    setIntent(null);
    setUnderstanding(null);
    setFailure(null);
    setExecutable(true);
    setActiveStage("spatial_mapping");

    const nextState = updateWorldState((prev) => {
      const now = Date.now();
      const previousObjects = prev.objects || [];

      return {
        ...prev,
        // 摄像头只刷新物体状态，机器人当前位置和持有状态不被重置。
        objects: detectedObjects.map((object) => {
          const previous = previousObjects.find(
            (item) =>
              item.id === object.id ||
              (item.name && object.name && item.name === object.name) ||
              (item.type && object.type && item.type === object.type)
          );
          const scenePoint = object.scenePosition || object.position || {};
          const worldPosition = scenePointToWorld({
            ...scenePoint,
            xPercent: object.position?.xPercent,
            yPercent: object.position?.yPercent
          });

          return {
            id: object.id,
            name: object.name,
            type: object.type,
            position: worldPosition,
            originalPosition: previous?.originalPosition || worldPosition,
            currentRegion: object.position?.region || getRegionFromWorld(worldPosition),
            targetRegion: previous?.targetRegion || null,
            isHeld: previous?.isHeld || false,
            isPlaced: previous?.isPlaced || false,
            lastUpdatedAt: now
          };
        })
      };
    });

    setHeldObjectId(null);
    addLog("更新", "worldState 已根据摄像头识别结果更新");
    addWorldStateLog(`摄像头感知已更新 worldState：${detectedObjects.map((object) => object.name).join("、")}`, nextState);

    if (options.lockScene) {
      lockScene({
        source: options.source || "摄像头单帧",
        description: data.sceneDescription || "",
        objectCount: detectedObjects.length
      });
    }
  }

  function moveRobotTo(target) {
    const next = { x: Math.max(20, target.x - 24), y: Math.max(20, target.y - 26) };
    setRobot(next);
    setRobotPath((prev) => [...prev, next].slice(-24));
    const nextState = updateWorldState((prev) => ({
      ...prev,
      robot: {
        ...prev.robot,
        position: robotSceneToWorld(next)
      }
    }));
    addWorldStateLog("机器人位置已保存", nextState);
  }

  function getTargetObjectForCurrentPlan() {
    const objectId = plan.find((step) => step.objectId)?.objectId;
    return (
      objects.find((object) => object.id === objectId) ||
      objects.find((object) => object.type === intent?.targetType || object.name === intent?.targetName) ||
      null
    );
  }

  function verifyTaskResult(targetObject, targetRegion) {
    const currentWorldState = worldStateRef.current;
    const objectState = currentWorldState.objects.find((object) => object.id === targetObject?.id);

    if (!targetObject || !objectState) {
      return { success: false, message: "目标物体不存在，无法验证任务结果。" };
    }

    if (targetRegion && !isObjectInTargetRegion(objectState, targetRegion)) {
      return {
        success: false,
        message: `${targetObject.name}最终位于${objectState.currentRegion || "未知区域"}，未到达目标区域。`
      };
    }

    if (currentWorldState.robot.holdingObjectId) {
      return { success: false, message: "机器人仍在持有物体，放置动作未完成。" };
    }

    return {
      success: true,
      message: targetRegion
        ? `${targetObject.name}已成功放置到${intent?.destination || "目标区域"}。`
        : `${targetObject.name}状态验证通过。`
    };
  }

  function validateBeforeExecution() {
    const currentWorldState = worldStateRef.current;
    const targetObject = getTargetObjectForCurrentPlan();
    const targetState = currentWorldState.objects.find((object) => object.id === targetObject?.id);
    const target = getTargetFromPlan(plan, intent);

    addLog("状态", `当前机器人位置：x=${currentWorldState.robot.position.x.toFixed(2)}, z=${currentWorldState.robot.position.z.toFixed(2)}`);
    addWorldStateLog("执行前 worldState 快照", currentWorldState);

    if (!objects.length || !currentWorldState.objects.length) {
      return { success: false, message: "当前场景没有可执行物体，请先识别场景。" };
    }

    if (!targetObject || !targetState) {
      return { success: false, message: `当前场景不存在“${intent?.targetName || "目标物体"}”。` };
    }

    addLog("状态", `当前${targetObject.name}位置：${targetState.currentRegion}`);
    addLog("验证", `检查${targetObject.name}是否已经在目标区域`);

    if (!targetObject.operable && ["move", "put_in"].includes(intent?.actionType)) {
      return { success: false, message: `${targetObject.name}不可操作：${targetObject.risk || "存在操作风险"}` };
    }

    if (!target.region && ["move", "put_in", "clean"].includes(intent?.actionType)) {
      return { success: false, message: "目标位置不明确，请重新输入任务。" };
    }

    if (currentWorldState.robot.holdingObjectId && currentWorldState.robot.holdingObjectId !== targetObject.id) {
      const holdingObject = currentWorldState.objects.find((object) => object.id === currentWorldState.robot.holdingObjectId);
      return { success: false, message: `机器人当前正在持有${holdingObject?.name || "其他物体"}，请先完成当前操作。` };
    }

    if (["move", "put_in"].includes(intent?.actionType) && isObjectInTargetRegion(targetState, target.region)) {
      addWorldStateLog(`${targetObject.name}已在目标区域，跳过重复执行`, currentWorldState);
      return {
        success: true,
        alreadyCompleted: true,
        targetObject,
        targetRegion: target.region,
        message: `${targetObject.name}已经位于${intent.destination}，无需重复执行。`,
        steps: [
          { step: 1, action: "verify_result", description: `检测到${targetObject.name}已经在目标区域`, status: "completed" },
          { step: 2, action: "done", description: "任务已完成，无需重复移动", status: "completed" }
        ]
      };
    }

    addLog("验证", `${targetObject.name}尚未到达目标区域，开始执行任务`);
    return { success: true, targetObject, targetRegion: target.region };
  }

  async function handlePerception() {
    if (!shouldAllowWorldStateOverwrite(imageFile ? "重新识别图片场景" : "重新读取内置场景")) return;

    setIsBusy(true);
    setResult("");
    setActiveStage("perception");
    addLog("感知", imageFile ? "AI 正在识别上传图片中的场景" : "AI 正在读取内置桌面场景");
    try {
      const data = await runPerception({ imageFile, mode: imageFile ? "uploaded-image" : "built-in-scene" });
      const detectedObjects = data.objects || [];
      if (!detectedObjects.length) {
        addLog("错误", "未识别到可用于规划的物体");
      }
      setObjects(detectedObjects);
      setPerceptionSummary(data.summary);
      setSceneDescription(data.sceneDescription || "");
      setPlan([]);
      setIntent(null);
      setUnderstanding(null);
      setFailure(null);
      setExecutable(true);
      const nextWorldState = initializeWorldState(detectedObjects, robot);
      updateWorldState(nextWorldState);
      setRobot(robotWorldToScene(nextWorldState.robot.position));
      setHeldObjectId(null);
      setMovedObjects(getMovedObjectsFromWorldState(nextWorldState));
      setRobotPath([robotWorldToScene(nextWorldState.robot.position)]);
      setActiveStage("spatial_mapping");
      lockScene({
        source: imageFile ? "图片上传" : "mock",
        description: data.sceneDescription || "",
        objectCount: detectedObjects.length
      });
      addLog("感知", `识别到物体：${detectedObjects.map((object) => `${object.name}(${object.type})`).join("、") || "无"}`);
      addLog("空间映射", "已完成 3D 空间映射，物体坐标已投射到虚拟桌面");
      addWorldStateLog("图片/内置感知已重建 worldState", nextWorldState);
    } catch (error) {
      setActiveStage("feedback");
      const message = error.message || "图片识别失败，请稍后重试。";
      setResult(message);
      addLog("错误", `图片识别失败：${message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePlan() {
    if (!worldStateRef.current.objects.length) {
      addLog("错误", "当前 worldState 没有物体，请先感知并锁定当前场景。");
      if (!window.confirm("当前 worldState 没有物体。是否仍然强制生成计划？")) return;
    }

    if (!sceneLock.locked) {
      addLog("规划", "建议先感知并锁定当前场景，再生成任务计划。");
      if (!window.confirm("建议先感知并锁定当前场景，再生成任务计划。是否强制继续？")) return;
      addLog("规划", "用户选择在未锁定场景状态下强制生成计划。");
    }

    setIsBusy(true);
    setResult("");
    setActiveStage("understanding");
    addLog("规划", `用户输入任务：${task || "空任务"}`);
    try {
      const data = await generatePlan({ task, objects: sceneObjects });
      setActiveStage("planning");
      setIntent(data.intent);
      setUnderstanding(data.understanding);
      setFailure(data.failure);
      setExecutable(data.executable);
      setPlan(data.plan);
      setCurrentStep(null);
      setHeldObjectId(null);
      const targetObject = sceneObjects.find((object) => object.type === data.intent?.targetType || object.name === data.intent?.targetName);
      setActiveObjectId(targetObject?.id || null);
      addLog("规划", `任务理解完成：目标=${data.intent.targetName}，动作=${data.intent.actionType}，位置=${data.intent.destination}`);
      addLog("规划", `AI 生成动作步骤：${data.plan.map((step) => step.action).join(" → ")}`);
      if (data.failure) {
        addLog("错误", `规划失败：${data.failure.reason}；建议：${data.failure.suggestion}`);
      }
    } catch (error) {
      setActiveStage("feedback");
      addLog("错误", `规划失败：${error.message}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function animateStep(step, token) {
    if (token !== executionToken.current) return;

    setCurrentStep(step.step);
    setPlan((prev) =>
      prev.map((item) => (item.step === step.step ? { ...item, status: "running" } : item))
    );
    addLog("执行", `机器人当前正在执行 Step ${step.step}：${step.description}`);

    if (["move_to", "avoid", "locate_target", "check_operability", "check_target_area", "move_to_object", "move_to_target", "verify_result"].includes(step.action) && step.position) {
      moveRobotTo(step.position);
      setActiveObjectId(step.objectId || null);
    }

    if (step.action === "pick" || step.action === "pick_object") {
      const target = step.position || robot;
      moveRobotTo(target);
      setActiveObjectId(step.objectId || null);
      await sleep(450);
      setHeldObjectId(step.objectId || null);
      updateWorldState((prev) => ({
        ...prev,
        robot: { ...prev.robot, holdingObjectId: step.objectId || null },
        objects: prev.objects.map((object) =>
          object.id === step.objectId
            ? { ...object, isHeld: true, lastUpdatedAt: Date.now() }
            : object
        )
      }));
      addWorldStateLog(`抓取状态已保存：${step.target || step.objectId || "目标物体"}`);
      addLog("执行", `已抓取${step.target || "目标物体"}`);
    }

    if (step.action === "place" || step.action === "place_object") {
      const target = step.position || { x: 500, y: 80 };
      moveRobotTo(target);
      await sleep(550);
      if (step.objectId) {
        setMovedObjects((prev) => ({ ...prev, [step.objectId]: target }));
      }
      setHeldObjectId(null);
      setActiveObjectId(step.objectId || null);
      const nextState = updateWorldState((prev) => {
        const targetRegion = getTargetRegion(step.targetArea || String(step.target || ""), target);
        const worldPosition = scenePointToWorld(target);
        return {
          ...prev,
          robot: { ...prev.robot, holdingObjectId: null },
          objects: prev.objects.map((object) =>
            object.id === step.objectId
              ? {
                  ...object,
                  position: worldPosition,
                  currentRegion: targetRegion || getRegionFromWorld(worldPosition),
                  targetRegion,
                  isHeld: false,
                  isPlaced: true,
                  lastUpdatedAt: Date.now()
                }
              : object
          )
        };
      });
      addWorldStateLog(`放置状态已保存：${step.target || step.objectId || "目标物体"}`, nextState);
      addLog("执行", `已放下${step.target || "目标物体"}`);
    }

    if (step.action === "retry") {
      moveRobotTo({ x: 94, y: 116 });
      setActiveObjectId(null);
    }

    if (step.action === "done") {
      setActiveObjectId(step.objectId || null);
    }

    await sleep(850);
    setPlan((prev) =>
      prev.map((item) => (item.step === step.step ? { ...item, status: "completed" } : item))
    );
    addLog("执行", `Step ${step.step} ${step.description} - ${statusText("completed")}`);
  }

  async function handleExecute() {
    setIsBusy(true);
    setResult("");
    setActiveStage("execution");
    const token = executionToken.current + 1;
    executionToken.current = token;

    try {
      const baseExecutorOptions = {
        plan,
        objects: sceneObjects,
        intent,
        task,
        addLog
      };

      if (executionMode === "simulation") {
        const executor = new SimulationExecutor({
          ...baseExecutorOptions,
          callbacks: {
            animateStep,
            validateBeforeExecution,
            verifyTaskResult,
            setPlan,
            setResult,
            setCurrentStep,
            setActiveObjectId,
            setActiveStage,
            updateWorldState,
            executeBackendPlan: executePlan,
            executable,
            failure,
            task,
            token
          }
        });
        await executor.executePlan(plan, worldStateRef.current, { worldStateRef });
        return;
      }

      if (!executable) {
        setResult(`任务无法执行：${failure?.reason || "条件不足"}`);
        addLog("错误", `执行阻止：${failure?.reason || "条件不足"}；建议：${failure?.suggestion || "请重新生成计划"}`);
        setActiveStage("feedback");
        return;
      }

      const executor =
        executionMode === "hardware"
          ? new HardwareExecutor({
              ...baseExecutorOptions,
              api: { getHardwareStatus, executeHardwareStep, executeHardwarePlan }
            })
          : new DryRunExecutor(baseExecutorOptions);

      const executionResult = await executor.executePlan(plan, worldStateRef.current, {
        validateBeforeExecution,
        updateWorldState
      });

      if (executionResult.alreadyCompleted || executionResult.status === "already_completed") {
        setPlan(executionResult.steps);
        setResult(executionResult.message);
        setActiveStage("feedback");
        addLog("完成", executionResult.message);
        updateWorldState((prev) => ({
          ...prev,
          lastTask: task,
          lastExecutionResult: {
            success: true,
            status: "already_completed",
            message: executionResult.message,
            finishedAt: Date.now()
          }
        }));
        return;
      }

      if (!executionResult.success) {
        setResult(`任务无法执行：${executionResult.message}`);
        addLog("错误", executionResult.message);
        setActiveStage("feedback");
        updateWorldState((prev) => ({
          ...prev,
          lastTask: task,
          lastExecutionResult: {
            success: false,
            status: executionResult.status || "executor_failed",
            message: executionResult.message,
            finishedAt: Date.now()
          }
        }));
        return;
      }

      setResult(executionResult.message || "执行适配层已完成处理。");
      setActiveStage("feedback");
      addLog("反馈", executionResult.message || "执行适配层已完成处理。");
    } catch (error) {
      setActiveStage("feedback");
      addLog("错误", `执行适配层失败：${error.message}`);
    } finally {
      setHeldObjectId(null);
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e9eef5] text-ink">
      <Header statusSummary={statusSummary} activeStage={activeStage} />
      <div className="mx-auto max-w-[1600px] px-5 pt-5">
        <ProcessStepper activeStage={activeStage} />
      </div>
      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-5 pb-5 pt-4 xl:grid-cols-[minmax(280px,22%)_minmax(0,1fr)]">
        <ControlPanel
            task={task}
            setTask={setTask}
            onPerception={handlePerception}
            onPlan={handlePlan}
            onExecute={handleExecute}
            isBusy={isBusy}
            canExecute={canExecute}
            imageName={imageName}
            setImageName={setImageName}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            setImageFile={setImageFile}
            onImageSelected={(file) => addLog("感知", file ? `图片上传成功：${file.name}` : "已清除上传图片")}
            worldState={worldState}
            objectCount={sceneObjects.length}
            executionMode={executionMode}
            setExecutionMode={setExecutionMode}
            onCameraResult={syncCameraPerceptionToWorld}
            onUnlockScene={unlockScene}
            onLog={addLog}
            sceneLock={sceneLock}
            isFrozen={isWorldUpdateFrozen}
            canUpdateWorld={!isWorldUpdateFrozen}
            worldSource={worldSource}
            logs={logs}
            plan={plan}
            objects={sceneObjects}
        />

        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3 shadow-soft">
            <div>
              <p className="text-sm text-slate-500">当前闭环状态</p>
              <p className="font-semibold text-ink">{statusSummary}</p>
            </div>
            <div className="h-2 w-44 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-signal transition-all"
                style={{ width: plan.length ? `${(plan.filter((step) => step.status === "completed").length / plan.length) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,34%)]">
            <EmbodiedWorld3D
              objects={sceneObjects}
              robot={robot}
              activeObjectId={activeObjectId}
              heldObjectId={heldObjectId}
              movedObjects={movedObjects}
              robotPath={robotPath}
              targetAreaPosition={targetAreaPosition}
              plan={plan}
              currentStep={currentStep}
            />
            <BottomInspector
              intent={intent}
              understanding={understanding}
              failure={failure}
              plan={plan}
              currentStep={currentStep}
              worldState={worldState}
              objects={sceneObjects}
              summary={perceptionSummary}
              sceneDescription={sceneDescription}
              imagePreview={imagePreview}
              logs={logs}
              result={result}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
