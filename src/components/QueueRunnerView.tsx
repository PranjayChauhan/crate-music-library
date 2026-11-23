import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  HardDrive,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Slash,
} from 'lucide-react';
import type { LocalFolderOption, TrackRecord, TrackStatus } from '../types';

interface QueueRunnerViewProps {
  tracks: TrackRecord[];
  folders: LocalFolderOption[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  isRunning: boolean;
  activeTrackId: string | null;
  activeProgress: number;
  onStart: () => void;
  onPause: () => void;
  onSkipCurrent: () => void;
  onRetryFailedAll: () => void;
  onRetrySingleTrack: (trackId: string) => void;
}

const STATUS_META: Record<
  TrackStatus,
  { label: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'pending',
    colorClass: 'text-[#ade8f4] bg-[#023e8a]/65 border-[#0077b6]/60',
    icon: Clock,
  },
  matched_local: {
    label: 'matched_local',
    colorClass: 'text-[#90e0ef] bg-[#0096c7]/20 border-[#00b4d8]/45',
    icon: HardDrive,
  },
  downloading: {
    label: 'downloading',
    colorClass: 'text-[#caf0f8] bg-[#00b4d8]/25 border-[#48cae4]/60',
    icon: Loader2,
  },
  downloaded: {
    label: 'downloaded',
    colorClass: 'text-[#48cae4] bg-[#00b4d8]/15 border-[#48cae4]/45',
    icon: CheckCircle2,
  },
  skipped: {
    label: 'skipped',
    colorClass: 'text-amber-300 bg-amber-500/10 border-amber-500/35',
    icon: Slash,
  },
  failed: {
    label: 'failed',
    colorClass: 'text-rose-300 bg-rose-500/15 border-rose-500/40',
    icon: AlertTriangle,
  },
  cloud_only: {
    label: 'cloud_only',
    colorClass: 'text-[#90e0ef] bg-[#0077b6]/25 border-[#0096c7]/45',
    icon: Clock,
  },
};

export const QueueRunnerView: React.FC<QueueRunnerViewProps> = ({
  tracks,
  folders,
  selectedFolderId,
  onSelectFolder,
  isRunning,
  activeTrackId,
  activeProgress,
  onStart,
  onPause,
  onSkipCurrent,
  onRetryFailedAll,
  onRetrySingleTrack,
}) => {
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? folders[0];
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;

  const pendingCount = tracks.filter((t) => t.status === 'pending').length;
  const failedCount = tracks.filter((t) => t.status === 'failed').length;
  const completedCount = tracks.filter(
    (t) => t.status === 'downloaded' || t.status === 'matched_local'
  ).length;

  // Show queue-relevant rows (all tracks ordered so active/failed/pending are immediately scannable)
  const runnerRows = [...tracks].sort((a, b) => {
    const rank = (s: TrackStatus): number => {
      if (s === 'downloading') return 0;
      if (s === 'failed') return 1;
      if (s === 'pending') return 2;
      if (s === 'downloaded') return 3;
      if (s === 'matched_local') return 4;
      if (s === 'skipped') return 5;
      return 6;
    };
    const diff = rank(a.status) - rank(b.status);
    return diff !== 0 ? diff : a.index - b.index;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#0077b6]/35 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#caf0f8]">
            1-by-1 Queue Runner
          </h1>
          <p className="text-sm text-[#90e0ef]/80 mt-1.5 max-w-2xl">
            Processes user-supplied authorized media URLs strictly one track at a time into your
            chosen local folder, verifying local matches first.
          </p>
        </div>

        <div className="font-mono text-xs tabular-nums text-[#90e0ef]/85">
          {completedCount} ready · {pendingCount} pending · {failedCount} failed
        </div>
      </div>

      {/* Local Target Folder + Runner Controls */}
      <section
        aria-label="Queue runner controls"
        className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="target-folder-select"
              className="flex items-center gap-2 text-xs font-medium text-[#90e0ef]/85 mb-2"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#48cae4]" aria-hidden="true" />
              Local Target Folder
            </label>
            <select
              id="target-folder-select"
              value={selectedFolderId}
              onChange={(e) => onSelectFolder(e.target.value)}
              disabled={isRunning}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#020326] border border-[#0077b6]/55 text-sm text-[#caf0f8] disabled:opacity-60 focus:border-[#48cae4] focus:outline-none"
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label} — {folder.path} ({folder.availableGb} GB free)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isRunning ? (
              <button
                type="button"
                onClick={onStart}
                disabled={pendingCount === 0}
                className="min-h-[44px] px-4 rounded-xl bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-40 text-[#03045e] text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                Start Queue
              </button>
            ) : (
              <button
                type="button"
                onClick={onPause}
                className="min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#03045e] text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                Pause
              </button>
            )}

            <button
              type="button"
              onClick={onSkipCurrent}
              disabled={!activeTrack}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#023e8a] hover:bg-[#0077b6] disabled:opacity-40 text-[#caf0f8] text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
              Skip Current
            </button>

            <button
              type="button"
              onClick={onRetryFailedAll}
              disabled={failedCount === 0}
              className="min-h-[44px] px-3.5 rounded-xl border border-[#0096c7]/60 hover:border-[#48cae4] disabled:opacity-40 text-[#ade8f4] text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Retry Failed ({failedCount})
            </button>
          </div>
        </div>

        {/* Strictly 1 Active Transfer Slot Progress Panel */}
        <div
          aria-live="polite"
          className="rounded-xl bg-[#020326]/90 border border-[#0077b6]/45 p-4"
        >
          {activeTrack ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#48cae4]">
                    Active Transfer (1 of 1 sequential slot)
                  </p>
                  <p className="text-sm font-semibold text-[#caf0f8] truncate mt-0.5">
                    {activeTrack.track_name}{' '}
                    <span className="font-normal text-[#90e0ef]/80">by {activeTrack.artist}</span>
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#caf0f8] shrink-0">
                  {activeProgress}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={activeProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Downloading ${activeTrack.track_name}`}
                className="h-2 w-full rounded-full bg-[#023e8a]/65 overflow-hidden"
              >
                <div
                  className="h-full bg-[#00b4d8] transition-[width] duration-150"
                  style={{ width: `${activeProgress}%` }}
                />
              </div>

              <p className="font-mono text-[11px] text-[#90e0ef]/70 truncate">
                Destination: {selectedFolder?.path}
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#90e0ef]/85">
              <span>
                {pendingCount > 0
                  ? `${pendingCount} pending ${pendingCount === 1 ? 'track' : 'tracks'} ready for sequential 1-by-1 transfer into ${selectedFolder?.path}.`
                  : 'Queue idle. All eligible pending tracks have been processed.'}
              </span>
              <span className="font-mono text-[#90e0ef]/65">Concurrency: 1 track</span>
            </div>
          )}
        </div>
      </section>

      {/* Live Row-by-Row Progress Table */}
      <section
        aria-label="Row by row transfer status"
        className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-[#0077b6]/35 text-xs font-medium text-[#90e0ef]/80">
                <th className="py-3.5 pl-5 pr-2 w-12 font-mono">#</th>
                <th className="py-3.5 px-3">Track</th>
                <th className="py-3.5 px-3 w-44">Status</th>
                <th className="py-3.5 px-3">Progress / Detail</th>
                <th className="py-3.5 pl-3 pr-5 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0077b6]/25">
              {runnerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#90e0ef]/75">
                    No tracks in your library yet. Import tracks or load the sample catalog from the
                    Library view.
                  </td>
                </tr>
              ) : (
                runnerRows.map((track) => {
                  const meta = STATUS_META[track.status];
                  const StatusIcon = meta.icon;
                  const isRowActive = track.id === activeTrackId && track.status === 'downloading';

                  return (
                    <tr
                      key={track.id}
                      className={`transition-colors ${
                        isRowActive ? 'bg-[#00b4d8]/12' : 'hover:bg-[#023e8a]/40'
                      }`}
                    >
                      <td className="py-3 pl-5 pr-2 font-mono text-xs tabular-nums text-[#90e0ef]/70">
                        {track.index}
                      </td>

                      <td className="py-3 px-3 max-w-[260px]">
                        <p className="text-sm font-medium text-[#caf0f8] truncate">
                          {track.track_name}
                        </p>
                        <p className="text-xs text-[#90e0ef]/80 truncate mt-0.5">
                          {track.artist} · {track.album}
                        </p>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs font-medium ${meta.colorClass}`}
                        >
                          <StatusIcon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              track.status === 'downloading' ? 'animate-spin' : ''
                            }`}
                            aria-hidden="true"
                          />
                          {meta.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isRowActive ? (
                          <div className="flex items-center gap-3 max-w-xs">
                            <div className="flex-1 h-1.5 rounded-full bg-[#023e8a] overflow-hidden">
                              <div
                                className="h-full bg-[#00b4d8] transition-[width] duration-150"
                                style={{ width: `${activeProgress}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-[#48cae4] w-9 text-right">
                              {activeProgress}%
                            </span>
                          </div>
                        ) : track.status === 'failed' ? (
                          <p className="text-xs text-rose-300">
                            {track.error_message || 'Transfer interrupted — ready to retry.'}
                          </p>
                        ) : track.status === 'skipped' ? (
                          <p className="text-xs text-amber-300/85">
                            {track.error_message || 'Skipped by user or missing direct media URL.'}
                          </p>
                        ) : track.status === 'downloaded' || track.status === 'matched_local' ? (
                          <p className="font-mono text-xs text-[#ade8f4]/85 truncate max-w-xs">
                            {track.media_url || 'Verified on local storage'}
                          </p>
                        ) : track.status === 'cloud_only' ? (
                          <p className="text-xs text-[#90e0ef]">Stored in Google Drive vault</p>
                        ) : (
                          <p className="text-xs text-[#90e0ef]/70">Waiting in sequential queue</p>
                        )}
                      </td>

                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        {track.status === 'failed' ? (
                          <button
                            type="button"
                            onClick={() => onRetrySingleTrack(track.id)}
                            aria-label={`Retry ${track.track_name}`}
                            className="min-h-[38px] px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            Retry
                          </button>
                        ) : isRowActive ? (
                          <button
                            type="button"
                            onClick={onSkipCurrent}
                            className="min-h-[38px] px-3 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-xs font-medium"
                          >
                            Skip
                          </button>
                        ) : (
                          <span className="font-mono text-xs tabular-nums text-[#90e0ef]/65">
                            {track.duration}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
