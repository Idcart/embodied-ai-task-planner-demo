import BaseExecutor from "./BaseExecutor";

export default class SimulationExecutor extends BaseExecutor {
  constructor(options = {}) {
    super({ ...options, mode: "simulation" });
    this.callbacks = options.callbacks || {};
  }

  validateBeforeExecute(plan, worldState) {
    return this.callbacks.validateBeforeExecution?.(plan, worldState) || { success: true };
  }

  async executeStep(step, worldState, token) {
    await this.callbacks.animateStep?.(step, token, worldState);
  }

  verifyAfterExecute(result, worldState) {
    return this.callbacks.verifyTaskResult?.(result.targetObject, result.targetRegion, worldState) || result;
  }

  async executePlan(plan, worldState, context = {}) {
    const {
      setPlan,
      setResult,
      setCurrentStep,
      setActiveObjectId,
      setActiveStage,
      updateWorldState,
      executeBackendPlan,
      executable,
      failure,
      task,
      token
    } = this.callbacks;

    if (!executable) {
      const message = `执行阻止：${failure?.reason || "条件不足"}；建议：${failure?.suggestion || "请重新生成计划"}`;
      setResult?.(`任务无法执行：${failure?.reason || "条件不足"}`);
      this.addLog("错误", message);
      setActiveStage?.("feedback");
      return { success: false, status: "blocked", message };
    }

    const validation = this.validateBeforeExecute(plan, worldState);
    if (!validation.success) {
      setResult?.(`任务无法执行：${validation.message}`);
      this.addLog("错误", validation.message);
      setActiveStage?.("feedback");
      updateWorldState?.((prev) => ({
        ...prev,
        lastTask: task,
        lastExecutionResult: {
          success: false,
          status: "validation_failed",
          message: validation.message,
          finishedAt: Date.now()
        }
      }));
      return { success: false, status: "validation_failed", message: validation.message };
    }

    if (validation.alreadyCompleted) {
      setPlan?.(validation.steps);
      setResult?.(validation.message);
      setActiveStage?.("feedback");
      this.addLog("完成", validation.message);
      updateWorldState?.((prev) => ({
        ...prev,
        lastTask: task,
        lastExecutionResult: {
          success: true,
          status: "already_completed",
          message: validation.message,
          finishedAt: Date.now()
        }
      }));
      return { success: true, status: "already_completed", message: validation.message };
    }

    setPlan?.((prev) => prev.map((step) => ({ ...step, status: "waiting" })));
    this.addLog("执行", "开始执行：机器人进入任务闭环");

    for (const step of plan) {
      await this.executeStep(step, worldState, token);
    }

    setActiveStage?.("verification");
    const verification = this.verifyAfterExecute(validation, context.worldStateRef?.current || worldState);
    if (!verification.success) {
      setResult?.(`执行失败：${verification.message}`);
      this.addLog("错误", verification.message);
      updateWorldState?.((prev) => ({
        ...prev,
        lastTask: task,
        lastExecutionResult: {
          success: false,
          status: "verification_failed",
          message: verification.message,
          finishedAt: Date.now()
        }
      }));
      setActiveStage?.("feedback");
      return { success: false, status: "verification_failed", message: verification.message };
    }

    this.addLog("验证", verification.message);
    const data = await executeBackendPlan?.({ task, plan, executable, failure });
    setResult?.(data.result);
    setCurrentStep?.(null);
    setActiveObjectId?.(null);
    setActiveStage?.("feedback");
    this.addLog("反馈", `任务是否完成：${data.success ? "已完成" : "未完成"}`);
    this.addLog("反馈", data.result);
    updateWorldState?.((prev) => ({
      ...prev,
      lastTask: task,
      lastExecutionResult: {
        success: Boolean(data.success),
        status: data.success ? "completed" : "failed",
        message: data.result,
        finishedAt: Date.now()
      }
    }));
    this.addLog("完成", "worldState 已更新");
    return { success: Boolean(data.success), status: data.success ? "completed" : "failed", message: data.result };
  }
}
