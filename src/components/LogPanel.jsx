import { TerminalSquare } from "lucide-react";

export default function LogPanel({ logs, result }) {
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
          logs.map((log, index) => (
            <p key={`${log}-${index}`} className="mb-1">
              <span className="text-teal-300">[{String(index + 1).padStart(2, "0")}]</span> {log}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
