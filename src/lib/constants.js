export const taskExamples = [
  "把杯子移动到桌子右上角",
  "找到桌面上的书",
  "把苹果放进篮子",
  "清理桌面上的杂物",
  "把手机移动到桌子右上角"
];

export const initialRobot = { x: 55, y: 70 };

export const actionLabels = {
  observe: "观察",
  observe_scene: "观察场景",
  locate_target: "定位目标",
  locate_target_object: "定位目标物体",
  check_operability: "检查可操作性",
  check_target_area: "检查目标区域",
  avoid: "避障",
  retry: "重试",
  move_to: "移动",
  move_to_object: "移动到物体",
  move_to_target: "移动到目标区",
  move_with_object_to_destination: "携带移动",
  pick: "抓取",
  pick_object: "抓取物体",
  place: "放置",
  place_object: "放置物体",
  verify_result: "验证结果",
  done: "完成"
};

export const flowStages = [
  { id: "perception", label: "感知" },
  { id: "spatial_mapping", label: "空间映射" },
  { id: "understanding", label: "任务理解" },
  { id: "planning", label: "规划" },
  { id: "execution", label: "执行" },
  { id: "verification", label: "验证" },
  { id: "feedback", label: "结果反馈" }
];
