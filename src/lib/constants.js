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
  avoid: "避障",
  retry: "重试",
  move_to: "移动",
  pick: "抓取",
  place: "放置",
  done: "完成"
};

export const flowStages = [
  { id: "perception", label: "感知" },
  { id: "understanding", label: "理解" },
  { id: "planning", label: "规划" },
  { id: "execution", label: "执行" },
  { id: "feedback", label: "反馈" }
];
