import { TerminalSquare } from "lucide-react";
import { useEffect, useRef } from "react";

const typeClassMap = {
  感知: "text-cyan-300",
  空间映射: "text-teal-300",
  规划: "text-amber-300",
  执行: "text-emerald-300",
  反馈: "text-violet-300",
  状态: "text-slate-300",
  验证: "text-sky-300",
  完成: "text-green-300",
  错误: "text-red-300"
};

export default function LogPanel({ logs, result }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="section-title">执行日志区</h2>
          <p className="section-subtitle">记录机器人每一步执行状态。</p>
        </div>
        <TerminalSquare size={20} className="text-slate-600" aria-hidden="true" />
      </div>

      {result ? (
        <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
          {result}
        </div>
      ) : null}

      <div className="h-48 overflow-y-auto rounded-lg bg-ink p-3 font-mono text-xs text-slate-100">
        {logs.length === 0 ? (
          <p className="text-slate-400">等待执行日志...</p>
        ) : (
          logs.map((log, index) => {
            const item = typeof log === "string" ? { type: "执行", message: log, time: "--:--:--" } : log;
            return (
              <p key={`${item.time}-${item.message}-${index}`} className="mb-1 leading-relaxed">
                <span className="text-slate-400">{item.time}</span>{" "}
                <span className={typeClassMap[item.type] || "text-teal-300"}>[{item.type}]</span>{" "}
                {item.message}
              </p>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </section>
  );
}
