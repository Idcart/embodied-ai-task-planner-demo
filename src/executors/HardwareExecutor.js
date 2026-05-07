import BaseExecutor from "./BaseExecutor";

export default class HardwareExecutor extends BaseExecutor {
  constructor(options = {}) {
    super({ ...options, mode: "hardware" });
    this.api = options.api || {};
  }

  async getStatus() {
    return this.api.getHardwareStatus?.();
  }

  async executeStep(step, worldState) {
    const command = this.stepToHardwareCommand(step, worldState);
    this.addLog("执行", `[Hardware] 即将发送指令：${command.command} -> ${command.target}`);
    const validation = this.validateHardwareCommand(command, step, worldState);
    if (!validation.success) throw new Error(validation.message);
    return this.api.executeHardwareStep?.({ step, command, worldState });
  }

  async executePlan(plan, worldState, context = {}) {
    const status = await this.getStatus();
    if (!status?.connected) {
      const message = status?.message || "当前未连接实体设备，已阻止真实执行。";
      this.addLog("错误", "当前未连接实体设备，已阻止真实执行。");
      return { success: false, status: "hardware_disconnected", message };
    }

    const validation = context.validateBeforeExecution?.(plan, worldState) || { success: true };
    if (!validation.success) return { success: false, status: "validation_failed", message: validation.message };
    if (validation.alreadyCompleted) return { ...validation, status: "already_completed" };

    const commands = this.planToHardwareCommands(plan, worldState);
    for (let index = 0; index < commands.length; index += 1) {
      const commandValidation = this.validateHardwareCommand(commands[index], plan[index], worldState);
      if (!commandValidation.success) {
        return { success: false, status: "hardware_validation_failed", message: commandValidation.message };
      }
      this.addLog("执行", `[Hardware] 指令校验通过：${commands[index].command} -> ${commands[index].target}`);
    }

    return this.api.executeHardwarePlan?.({ plan, commands, worldState, task: this.task });
  }
}
