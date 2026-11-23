import React, { useEffect } from 'react';
import { BarChart3, Cloud, HardDrive, ListMusic, Pin, X } from 'lucide-react';
import type { LibraryStats, PlaylistAnalyticsItem } from '../types';

interface LibraryAnalyticsModalProps {
  open: boolean;
  stats: LibraryStats;
  playlistCount: number;
  playlistAnalytics: PlaylistAnalyticsItem[];
  onClose: () => void;
  onSelectPlaylist: (playlistId: string) => void;
}

export const LibraryAnalyticsModal: React.FC<LibraryAnalyticsModalProps> = ({
  open,
  stats,
  playlistCount,
  playlistAnalytics,
  onClose,
  onSelectPlaylist,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const totalSafe = Math.max(1, stats.totalSongs);
  const otherTotal = Math.max(0, stats.totalSongs - stats.localReadyCount - stats.cloudReadyCount);
  const localPct = stats.totalSongs > 0 ? Math.round((stats.localReadyCount / totalSafe) * 100) : 0;
  const cloudPct = stats.totalSongs > 0 ? Math.round((stats.cloudReadyCount / totalSafe) * 100) : 0;
  const otherPct = stats.totalSongs > 0 ? Math.max(0, 100 - localPct - cloudPct) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="Close Library Analytics"
        onClick={onClose}
        className="fixed inset-0 bg-[#020326]/80 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Library Analytics"
        className="relative z-10 w-full max-w-2xl max-h-[88vh] bg-[#03045e] border border-[#0096c7]/65 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#0077b6]/45 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-[#023e8a] border border-[#0096c7]/55 text-[#48cae4] flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-semibold text-[#caf0f8] truncate">
                Library Analytics
              </h2>
              <p className="text-xs text-[#90e0ef]/80 truncate">
                Catalog totals, deduplication, and local vs. cloud storage per playlist
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close analytics dialog"
            className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 [scrollbar-gutter:stable]">
          {/* Library Summary Stats */}
          <section aria-label="Catalog overview metrics" className="space-y-3">
            <div className="grid grid-cols-3 divide-x divide-[#0077b6]/40 bg-[#020326]/55 border border-[#0077b6]/45 rounded-xl">
              <div className="p-3.5 sm:p-4">
                <p className="text-xs font-medium text-[#90e0ef]/85 whitespace-nowrap">Total Songs</p>
                <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-[#caf0f8] mt-1">
                  {stats.totalSongs}
                </p>
                <p className="text-[11px] text-[#90e0ef]/70 mt-1">
                  {playlistCount} {playlistCount === 1 ? 'playlist' : 'playlists'}
                </p>
              </div>

              <div className="p-3.5 sm:p-4">
                <p className="text-xs font-medium text-[#90e0ef]/85 whitespace-nowrap">Deduplicated</p>
                <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-[#caf0f8] mt-1">
                  {stats.deduplicatedCount}
                </p>
                <p className="text-[11px] text-[#90e0ef]/70 mt-1">Duplicate rows skipped</p>
              </div>

              <div className="p-3.5 sm:p-4">
                <p className="text-xs font-medium text-[#90e0ef]/85 whitespace-nowrap">
                  <span className="sm:hidden">Local / Cloud</span>
                  <span className="hidden sm:inline">Local / Cloud Ready</span>
                </p>
                <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-[#caf0f8] mt-1">
                  <span className="text-[#48cae4]">{stats.localReadyCount}</span>
                  <span className="text-[#0096c7] mx-1">/</span>
                  <span>{stats.cloudReadyCount}</span>
                </p>
                <p className="text-[11px] text-[#90e0ef]/70 mt-1">
                  {stats.pinnedCount} pinned offline
                </p>
              </div>
            </div>

            {/* Overall Storage Distribution Bar */}
            <div className="bg-[#020326]/45 border border-[#0077b6]/35 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#ade8f4]">Overall Storage Distribution</span>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#90e0ef]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#00b4d8]" aria-hidden="true" />
                    Local ({stats.localReadyCount})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#90e0ef]" aria-hidden="true" />
                    Cloud ({stats.cloudReadyCount})
                  </span>
                  {otherTotal > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#0077b6]/70" aria-hidden="true" />
                      Pending / Failed ({otherTotal})
                    </span>
                  )}
                </div>
              </div>

              <div
                className="h-2.5 w-full rounded-full bg-[#023e8a] overflow-hidden flex"
                role="img"
                aria-label={`Storage split: ${stats.localReadyCount} local, ${stats.cloudReadyCount} cloud, ${otherTotal} pending or failed`}
              >
                {localPct > 0 && (
                  <div
                    className="h-full bg-[#00b4d8] transition-[width] duration-300"
                    style={{ width: `${localPct}%` }}
                  />
                )}
                {cloudPct > 0 && (
                  <div
                    className="h-full bg-[#90e0ef] transition-[width] duration-300"
                    style={{ width: `${cloudPct}%` }}
                  />
                )}
                {otherPct > 0 && (
                  <div
                    className="h-full bg-[#0077b6]/75 transition-[width] duration-300"
                    style={{ width: `${otherPct}%` }}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Per-Playlist Storage Breakdown */}
          <section aria-label="Per-playlist storage analytics" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[#caf0f8]">
                Playlist Storage Breakdown
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#90e0ef]/75">
                {playlistAnalytics.length} {playlistAnalytics.length === 1 ? 'group' : 'groups'}
              </span>
            </div>

            {playlistAnalytics.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-[#0077b6]/50 rounded-xl px-4">
                <ListMusic className="w-6 h-6 text-[#0096c7] mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-[#caf0f8]">No playlists to analyze yet</p>
                <p className="text-xs text-[#90e0ef]/75 mt-1">
                  Create a playlist or import your catalog to view per-playlist local and cloud storage counts.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {playlistAnalytics.map((item) => {
                  const denom = Math.max(1, item.totalSongs);
                  const plLocalPct = item.totalSongs > 0 ? (item.localCount / denom) * 100 : 0;
                  const plCloudPct = item.totalSongs > 0 ? (item.cloudCount / denom) * 100 : 0;
                  const plOtherPct = item.totalSongs > 0 ? (item.otherCount / denom) * 100 : 0;
                  const isUnassigned = item.playlistId === '__unassigned__';

                  return (
                    <div
                      key={item.playlistId}
                      className="p-3.5 rounded-xl bg-[#023e8a]/55 border border-[#0077b6]/45 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ListMusic className="w-4 h-4 text-[#48cae4] shrink-0" aria-hidden="true" />
                          {isUnassigned ? (
                            <span className="text-sm font-semibold text-[#caf0f8] truncate">
                              {item.playlistName}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPlaylist(item.playlistId);
                                onClose();
                              }}
                              className="text-sm font-semibold text-[#caf0f8] hover:text-[#48cae4] truncate text-left transition-colors"
                            >
                              {item.playlistName}
                            </button>
                          )}
                        </div>

                        <span className="font-mono text-xs font-semibold tabular-nums text-[#caf0f8] bg-[#020326]/70 border border-[#0077b6]/50 px-2.5 py-1 rounded-md shrink-0">
                          {item.totalSongs} {item.totalSongs === 1 ? 'song' : 'songs'}
                        </span>
                      </div>

                      {/* Metric Trio: Local, Cloud, Pinned / Other */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-[#020326]/55 px-2.5 py-2 flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[#ade8f4] truncate">
                            <HardDrive className="w-3.5 h-3.5 text-[#00b4d8] shrink-0" aria-hidden="true" />
                            <span>Local</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-[#48cae4]">
                            {item.localCount}
                          </span>
                        </div>

                        <div className="rounded-lg bg-[#020326]/55 px-2.5 py-2 flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[#ade8f4] truncate">
                            <Cloud className="w-3.5 h-3.5 text-[#90e0ef] shrink-0" aria-hidden="true" />
                            <span>Cloud</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-[#caf0f8]">
                            {item.cloudCount}
                          </span>
                        </div>

                        <div className="rounded-lg bg-[#020326]/55 px-2.5 py-2 flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1.5 text-[#90e0ef]/85 truncate">
                            <Pin className="w-3.5 h-3.5 text-[#48cae4] shrink-0" aria-hidden="true" />
                            <span>Pinned</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-[#ade8f4]">
                            {item.pinnedCount}
                          </span>
                        </div>
                      </div>

                      {/* Stacked Storage Ratio Bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-[#020326]/80 overflow-hidden flex">
                          {plLocalPct > 0 && (
                            <div
                              className="h-full bg-[#00b4d8]"
                              style={{ width: `${plLocalPct}%` }}
                            />
                          )}
                          {plCloudPct > 0 && (
                            <div
                              className="h-full bg-[#90e0ef]"
                              style={{ width: `${plCloudPct}%` }}
                            />
                          )}
                          {plOtherPct > 0 && (
                            <div
                              className="h-full bg-[#0077b6]/70"
                              style={{ width: `${plOtherPct}%` }}
                            />
                          )}
                        </div>
                        {item.otherCount > 0 && (
                          <p className="text-[11px] text-[#90e0ef]/70">
                            {item.otherCount} {item.otherCount === 1 ? 'track' : 'tracks'} pending or failed local transfer
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};
