import { useMemo, useRef, useState } from "react";
import FlowDiagram from "./components/FlowDiagram";
import Header from "./components/Header";
import LogPanel from "./components/LogPanel";
import PerceptionPanel from "./components/PerceptionPanel";
import PlanPanel from "./components/PlanPanel";
import EmbodiedWorld3D from "./components/EmbodiedWorld3D";
import TaskPanel from "./components/TaskPanel";
import { executePlan, generatePlan, runPerception } from "./lib/api";
import { initialRobot } from "./lib/constants";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function statusText(status) {
  if (status === "completed") return "已完成";
  if (status === "running") return "执行中";
  return "等待中";
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
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeStage, setActiveStage] = useState("perception");
  const executionToken = useRef(0);

  const canPlan = objects.length > 0 && task.trim().length > 0;
  const canExecute = plan.length > 0;

  const statusSummary = useMemo(() => {
    const completed = plan.filter((step) => step.status === "completed").length;
    return plan.length ? `${completed}/${plan.length} 步完成` : "等待规划";
  }, [plan]);

  async function handlePerception() {
    setIsBusy(true);
    setResult("");
    setActiveStage("perception");
    setLogs((prev) => [
      ...prev,
      imageFile ? "开始感知：上传图片并调用真实视觉模型识别" : "开始感知：读取内置桌面场景并调用 mock 视觉识别"
    ]);
    try {
      const data = await runPerception({ imageFile, mode: imageFile ? "uploaded-image" : "built-in-scene" });
      setObjects(data.objects);
      setPerceptionSummary(data.summary);
      setSceneDescription(data.sceneDescription || "");
      setPlan([]);
      setIntent(null);
      setUnderstanding(null);
      setFailure(null);
      setExecutable(true);
      setMovedObjects({});
      setRobot(initialRobot);
      setLogs((prev) => [...prev, `感知完成：${data.summary}`]);
    } catch (error) {
      setLogs((prev) => [...prev, `感知失败：${error.message}`]);
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePlan() {
    setIsBusy(true);
    setResult("");
    setActiveStage("understanding");
    setLogs((prev) => [...prev, `理解任务：${task}`]);
    try {
      const data = await generatePlan({ task, objects });
      setActiveStage("planning");
      setIntent(data.intent);
      setUnderstanding(data.understanding);
      setFailure(data.failure);
      setExecutable(data.executable);
      setPlan(data.plan);
      setCurrentStep(null);
      setHeldObjectId(null);
      setActiveObjectId(null);
      setLogs((prev) => {
        const next = [
          ...prev,
          `理解完成：目标=${data.intent.targetName}，动作=${data.intent.actionType}，位置=${data.intent.destination}`,
          `规划完成：${data.summary}`
        ];
        if (data.failure) {
          next.push(`失败原因：${data.failure.reason}`, `建议：${data.failure.suggestion}`);
        }
        return next;
      });
    } catch (error) {
      setLogs((prev) => [...prev, `规划失败：${error.message}`]);
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
    setLogs((prev) => [...prev, `Step ${step.step} ${step.description} - 执行中`]);

    if (step.action === "move_to" || step.action === "observe" || step.action === "avoid") {
      const target = step.position || { x: 280, y: 200 };
      setRobot({ x: Math.max(20, target.x - 24), y: Math.max(20, target.y - 26) });
      setActiveObjectId(step.objectId || null);
    }

    if (step.action === "pick") {
      const target = step.position || robot;
      setRobot({ x: Math.max(20, target.x - 24), y: Math.max(20, target.y - 26) });
      setActiveObjectId(step.objectId || null);
      await sleep(450);
      setHeldObjectId(step.objectId || null);
    }

    if (step.action === "place") {
      const target = step.position || { x: 500, y: 80 };
      setRobot({ x: Math.max(20, target.x - 24), y: Math.max(20, target.y - 26) });
      await sleep(550);
      if (step.objectId) {
        setMovedObjects((prev) => ({ ...prev, [step.objectId]: target }));
      }
      setHeldObjectId(null);
      setActiveObjectId(step.objectId || null);
    }

    if (step.action === "retry") {
      setRobot({ x: 70, y: 90 });
      setActiveObjectId(null);
    }

    if (step.action === "done") {
      setActiveObjectId(step.objectId || null);
    }

    await sleep(850);
    setPlan((prev) =>
      prev.map((item) => (item.step === step.step ? { ...item, status: "completed" } : item))
    );
    setLogs((prev) => [...prev, `Step ${step.step} ${step.description} - ${statusText("completed")}`]);
  }

  async function handleExecute() {
    setIsBusy(true);
    setResult("");
    setActiveStage("execution");
    const token = executionToken.current + 1;
    executionToken.current = token;

    try {
      if (!executable) {
        setResult(`任务无法执行：${failure?.reason || "条件不足"}`);
        setLogs((prev) => [
          ...prev,
          `执行阻止：${failure?.reason || "条件不足"}`,
          `建议：${failure?.suggestion || "请重新生成计划"}`
        ]);
        setActiveStage("feedback");
        return;
      }

      setPlan((prev) => prev.map((step) => ({ ...step, status: "waiting" })));
      setLogs((prev) => [...prev, "开始执行：机器人进入任务闭环"]);

      for (const step of plan) {
        await animateStep(step, token);
      }

      const data = await executePlan({ task, plan, executable, failure });
      setResult(data.result);
      setCurrentStep(null);
      setActiveObjectId(null);
      setActiveStage("feedback");
      setLogs((prev) => [...prev, "执行完成：后端模拟执行结果已返回", data.result]);
    } catch (error) {
      setLogs((prev) => [...prev, `执行失败：${error.message}`]);
    } finally {
      setHeldObjectId(null);
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#edf2f7] text-ink">
      <Header />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-5 xl:grid-cols-[390px_1fr]">
        <div className="space-y-4">
          <TaskPanel
            task={task}
            setTask={setTask}
            onPerception={handlePerception}
            onPlan={handlePlan}
            onExecute={handleExecute}
            isBusy={isBusy}
            canPlan={canPlan}
            canExecute={canExecute}
            imageName={imageName}
            setImageName={setImageName}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            setImageFile={setImageFile}
          />
          <PerceptionPanel
            objects={objects}
            summary={perceptionSummary}
            sceneDescription={sceneDescription}
            imagePreview={imagePreview}
          />
        </div>

        <div className="space-y-4">
          <FlowDiagram activeStage={activeStage} />
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
          <EmbodiedWorld3D
            objects={objects}
            robot={robot}
            activeObjectId={activeObjectId}
            heldObjectId={heldObjectId}
            movedObjects={movedObjects}
            plan={plan}
            currentStep={currentStep}
          />
        </div>

        <div className="space-y-4 xl:col-span-2 xl:grid xl:grid-cols-[1fr_390px] xl:gap-4 xl:space-y-0">
          <PlanPanel
            intent={intent}
            understanding={understanding}
            failure={failure}
            plan={plan}
            currentStep={currentStep}
          />
          <LogPanel logs={logs} result={result} />
        </div>
      </main>
    </div>
  );
}
