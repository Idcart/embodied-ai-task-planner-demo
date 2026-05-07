import BaseExecutor from "./BaseExecutor";

export default class DryRunExecutor extends BaseExecutor {
  validateBeforeExecute(plan, worldState) {
    const commands = this.planToHardwareCommands(plan, worldState);
    for (let index = 0; index < commands.length; index += 1) {
      const validation = this.validateHardwareCommand(commands[index], plan[index], worldState);
      if (!validation.success) return validation;
    }
    return { success: true, commands };
  }

  async executeStep(step, worldState) {
    const command = this.stepToHardwareCommand(step, worldState);
    this.addLog("执行", this.formatDryRunLog(command));
    return command;
  }

  verifyAfterExecute(result) {
    return result;
  }

  async executePlan(plan, worldState, context = {}) {
    const validation = context.validateBeforeExecution?.(plan, worldState) || { success: true };
    if (!validation.success) return { success: false, status: "validation_failed", message: validation.message };
    if (validation.alreadyCompleted) return { ...validation, status: "already_completed" };

    const commandValidation = this.validateBeforeExecute(plan, worldState);
    if (!commandValidation.success) return { success: false, status: "dry_run_validation_failed", message: commandValidation.message };

    this.addLog("执行", "Dry Run 模式：仅生成实体机器人指令，不播放 3D 动画");
    for (const step of plan) {
      await this.executeStep(step, worldState);
    }

    const message = `Dry Run 已生成 ${commandValidation.commands.length} 条实体指令，未控制真实硬件。`;
    context.updateWorldState?.((prev) => ({
      ...prev,
      lastTask: this.task,
      lastExecutionResult: {
        success: true,
        status: "dry_run_completed",
        message,
        commands: commandValidation.commands,
        finishedAt: Date.now()
      }
    }));
    return { success: true, status: "dry_run_completed", message, commands: commandValidation.commands };
  }
}
