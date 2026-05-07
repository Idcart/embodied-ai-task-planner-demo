import { Bot, Boxes, ClipboardCheck, Hand } from "lucide-react";

function formatPosition(position) {
  if (!position) return "x=0.00, z=0.00";
  return `x=${Number(position.x || 0).toFixed(2)}, z=${Number(position.z || 0).toFixed(2)}`;
}

export default function WorldStatePanel({ worldState, objectCount }) {
  const holdingObject = worldState.objects.find((object) => object.id === worldState.robot.holdingObjectId);
  const lastResult = worldState.lastExecutionResult;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-slate-100 shadow-soft">
      <div className="mb-3">
        <h2 className="text-base font-semibold">World State</h2>
        <p className="mt-1 text-sm text-slate-400">当前虚拟世界的真实状态。</p>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Bot size={17} className="text-cyan-300" aria-hidden="true" />
          <span className="text-slate-400">机器人</span>
          <span className="ml-auto font-mono text-xs">{formatPosition(worldState.robot.position)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Hand size={17} className="text-amber-300" aria-hidden="true" />
          <span className="text-slate-400">持有物体</span>
          <span className="ml-auto">{holdingObject?.name || "无"}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Boxes size={17} className="text-teal-300" aria-hidden="true" />
          <span className="text-slate-400">识别物体</span>
          <span className="ml-auto">{objectCount} 个</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <ClipboardCheck size={17} className="text-violet-300" aria-hidden="true" />
          <span className="text-slate-400">最近任务</span>
          <span className="ml-auto max-w-[170px] truncate">{lastResult?.message || "暂无"}</span>
        </div>
      </div>
    </section>
  );
}
