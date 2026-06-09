import { useMemo, useState } from "react";
import { getEpisodeDownloadUrl } from "../lib/api";

function statusBadge(success) {
  return success ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";
}

function trainingBadge(ready) {
  return ready ? "bg-cyan-50 text-cyan-700 border-cyan-200" : "bg-slate-50 text-slate-600 border-slate-200";
}

export default function EpisodePanel({ episodes = [], currentEpisode, onRefresh, onSelectEpisode, selectedEpisode }) {
  const [filter, setFilter] = useState("all");

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((episode) => {
      const summary = episode.summary || episode.episode_summary || {};
      const ready = Boolean(summary.is_training_ready || episode.data_quality?.is_training_ready);
      if (filter === "success") return episode.success;
      if (filter === "failed") return !episode.success;
      if (filter === "ready") return ready;
      if (filter === "not_ready") return !ready;
      return true;
    });
  }, [episodes, filter]);

  const displayEpisode = selectedEpisode || currentEpisode || null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Episode 数据采集</h3>
          <p className="mt-1 text-xs text-slate-500">任务执行完成后自动生成 JSON，可在这里核对和下载。</p>
        </div>
        <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={onRefresh}>
          刷新列表
        </button>
      </div>

      {currentEpisode ? (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
          <p className="font-semibold">本次生成：{currentEpisode.episode_id}</p>
          <p className="mt-1 text-xs">任务：{currentEpisode.user_task_instruction || "未记录"}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          暂无本次新生成 Episode。完成一次仿真执行后会显示在这里。
        </div>
      )}

      <select
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      >
        <option value="all">全部 Episode</option>
        <option value="success">只看成功样本</option>
        <option value="failed">只看失败样本</option>
        <option value="ready">只看可训练样本</option>
        <option value="not_ready">只看不可训练样本</option>
      </select>

      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {filteredEpisodes.map((episode) => {
          const summary = episode.summary || episode.episode_summary || {};
          const qualityScore = summary.quality_score ?? episode.data_quality?.sample_quality_score ?? "-";
          const ready = Boolean(summary.is_training_ready || episode.data_quality?.is_training_ready);
          return (
            <div key={episode.episode_id} className="rounded-lg border border-line bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{episode.episode_id}</p>
                  <p className="mt-1 text-xs text-slate-500">任务：{summary.task_description || "未记录"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    物体 {summary.object_count ?? 0} 个 · 质量分 {qualityScore}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-right">
                  <span className={"rounded-full border px-2 py-0.5 text-xs " + statusBadge(episode.success)}>
                    {episode.success ? "成功" : "失败"}
                  </span>
                  <span className={"rounded-full border px-2 py-0.5 text-xs " + trainingBadge(ready)}>
                    {ready ? "可训练" : "待优化"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="secondary-button px-3 py-2 text-xs"
                  onClick={() => onSelectEpisode?.(episode.episode_id)}
                >
                  查看 JSON
                </button>
                <a className="secondary-button px-3 py-2 text-xs" href={getEpisodeDownloadUrl(episode.episode_id)}>
                  下载 JSON
                </a>
              </div>
            </div>
          );
        })}
        {!filteredEpisodes.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            当前筛选条件下没有 Episode。
          </div>
        ) : null}
      </div>

      {displayEpisode ? (
        <div className="rounded-lg border border-line bg-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-cyan-100">JSON 预览</p>
            <span className="text-xs text-cyan-100/60">{displayEpisode.episode_id}</span>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-cyan-50">
            {JSON.stringify(displayEpisode, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
