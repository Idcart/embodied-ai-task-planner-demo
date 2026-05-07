import {
  calibrationConfig,
  getSafeRobotCoord,
  isRobotCoordInTable,
  regionToRobotCoord,
  virtual3DToRobotCoord
} from "../utils/coordinateTransform";
import { getTargetRegion, scenePointToWorld } from "../lib/worldState";

const hardwareActionMap = {
  observe_scene: "observe",
  locate_target: "move_to",
  check_operability: "verify",
  check_target_area: "verify",
  move_to_object: "move_to",
  pick_object: "pick",
  pick: "pick",
  move_to_target: "move_to",
  place_object: "place",
  place: "place",
  verify_result: "verify",
  done: "stop",
  retry: "stop",
  avoid: "move_to"
};

export default class BaseExecutor {
  constructor(options = {}) {
    this.mode = options.mode || "simulation";
    this.plan = options.plan || [];
    this.objects = options.objects || [];
    this.intent = options.intent || null;
    this.task = options.task || "";
    this.addLog = options.addLog || (() => {});
    this.calibrationConfig = options.calibrationConfig || calibrationConfig;
  }

  async executePlan() {
    throw new Error("executePlan must be implemented by executor subclass");
  }

  async executeStep() {
    throw new Error("executeStep must be implemented by executor subclass");
  }

  validateBeforeExecute(_plan, _worldState) {
    return { success: true };
  }

  verifyAfterExecute(result) {
    return result;
  }

  getObjectByStep(step) {
    return this.objects.find((object) => object.id === step.objectId) || null;
  }

  getWorldObject(worldState, objectId) {
    return worldState?.objects?.find((object) => object.id === objectId) || null;
  }

  normalizeVirtualPosition(position = {}) {
    if (typeof position.z === "number") return position;
    return scenePointToWorld(position);
  }

  getRegionCoord(regionLike) {
    const region = getTargetRegion(String(regionLike || ""), null) || regionLike;
    return regionToRobotCoord(region, this.calibrationConfig);
  }

  stepToHardwareCommand(step, worldState) {
    const command = hardwareActionMap[step.action] || "verify";
    const object = this.getObjectByStep(step);
    const stateObject = this.getWorldObject(worldState, step.objectId);
    const target = object?.name || step.target || step.objectId || "scene";
    const base = {
      command,
      target,
      speed: "slow",
      safetyCheck: true,
      sourceAction: step.action,
      description: step.description || ""
    };

    if (command === "observe" || command === "verify" || command === "stop") {
      return base;
    }

    if (command === "pick") {
      return {
        ...base,
        position: virtual3DToRobotCoord(stateObject?.position || object?.worldPosition || {}, this.calibrationConfig)
      };
    }

    if (command === "place") {
      const regionCoord = this.getRegionCoord(step.targetRegion || step.targetArea || this.intent?.destination);
      return {
        ...base,
        position:
          regionCoord ||
          (step.targetPosition
            ? virtual3DToRobotCoord(this.normalizeVirtualPosition(step.targetPosition), this.calibrationConfig)
            : virtual3DToRobotCoord(stateObject?.position || {}, this.calibrationConfig))
      };
    }

    if (step.action === "move_to_target") {
      const regionCoord = this.getRegionCoord(step.targetRegion || step.targetArea || this.intent?.destination);
      const position = regionCoord || (step.targetPosition ? virtual3DToRobotCoord(this.normalizeVirtualPosition(step.targetPosition), this.calibrationConfig) : null);
      return {
        ...base,
        target: step.targetArea || this.intent?.destination || target,
        position: position ? getSafeRobotCoord(position, this.calibrationConfig) : undefined
      };
    }

    return {
      ...base,
      position: getSafeRobotCoord(
        virtual3DToRobotCoord(stateObject?.position || object?.worldPosition || {}, this.calibrationConfig),
        this.calibrationConfig
      )
    };
  }

  planToHardwareCommands(plan, worldState) {
    return plan.map((step) => this.stepToHardwareCommand(step, worldState));
  }

  validateHardwareCommand(command, step, worldState) {
    if (command.position && !isRobotCoordInTable(command.position, this.calibrationConfig)) {
      return { success: false, message: `硬件指令越界：${command.command} ${command.target}` };
    }

    if (command.position && Number(command.position.z) < this.calibrationConfig.zPickHeight) {
      return { success: false, message: `硬件指令高度低于安全阈值：z=${command.position.z}` };
    }

    const object = this.getObjectByStep(step);
    if (["pick", "gripper_close"].includes(command.command) && object?.operable === false) {
      return { success: false, message: `${object.name}不可操作，已阻止抓取指令。` };
    }

    if (["pick", "gripper_close"].includes(command.command) && worldState?.robot?.holdingObjectId) {
      return { success: false, message: "机器人当前已持有物体，已阻止二次抓取。" };
    }

    return { success: true };
  }

  formatDryRunLog(command) {
    if (command.command === "move_to" && command.position) {
      return `[DryRun] move_to x=${command.position.x}m y=${command.position.y}m z=${command.position.z}m`;
    }
    if (command.command === "pick") return "[DryRun] gripper close";
    if (command.command === "place") return `[DryRun] gripper open target=${command.target}`;
    return `[DryRun] ${command.command} target=${command.target}`;
  }
}
