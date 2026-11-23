import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronRight,
  Cloud,
  CloudOff,
  CloudUpload,
  Folder,
  HardDrive,
  Pin,
  PinOff,
  Search,
} from 'lucide-react';
import type {
  DriveFileItem,
  DriveFolder,
  GoogleDriveState,
  SortDirection,
  TrackAuxMeta,
  TrackRecord,
} from '../types';
import { filterAndSortDriveFiles, isLocalReady } from '../utils/libraryUtils';

interface CloudDriveViewProps {
  driveState: GoogleDriveState;
  driveError?: string | null;
  isTogglingConnection: boolean;
  folders: DriveFolder[];
  files: DriveFileItem[];
  tracks: TrackRecord[];
  trackMeta: Record<string, TrackAuxMeta>;
  onToggleConnectDrive: () => void;
  onUploadLocalTracks: (folderId: string) => number;
  onOffloadLocalTrack: (trackId: string) => void;
  onTogglePinOffline: (trackId: string) => void;
  onToggleDriveFilePin: (fileId: string) => void;
}

export const CloudDriveView: React.FC<CloudDriveViewProps> = ({
  driveState,
  driveError,
  isTogglingConnection,
  folders,
  files,
  tracks,
  trackMeta,
  onToggleConnectDrive,
  onUploadLocalTracks,
  onOffloadLocalTrack,
  onTogglePinOffline,
  onToggleDriveFilePin,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('drv-lossless');
  const [cloudQuery, setCloudQuery] = useState('');
  const [cloudSortBy, setCloudSortBy] = useState<'artist' | 'album' | 'date'>('date');
  const [cloudSortDir, setCloudSortDir] = useState<SortDirection>('desc');
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!actionBanner) return;
    const timer = window.setTimeout(() => setActionBanner(null), 3500);
    return () => window.clearTimeout(timer);
  }, [actionBanner]);

  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? folders[0];
  const childFolders = folders.filter((f) => f.parentId === currentFolderId);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) {
      counts[f.folderId] = (counts[f.folderId] ?? 0) + 1;
    }
    return counts;
  }, [files]);

  const visibleFiles = useMemo(() => {
    const inFolder =
      currentFolderId === 'drv-root'
        ? files
        : files.filter((f) => f.folderId === currentFolderId);
    return filterAndSortDriveFiles(inFolder, {
      query: cloudQuery,
      sortBy: cloudSortBy,
      sortDir: cloudSortDir,
    });
  }, [files, currentFolderId, cloudQuery, cloudSortBy, cloudSortDir]);

  const localTracks = useMemo(() => tracks.filter((t) => isLocalReady(t)), [tracks]);
  const pinnedTracks = useMemo(() => tracks.filter((t) => t.isPinnedOffline), [tracks]);

  const pinnedUsedMb = useMemo(() => {
    return pinnedTracks.reduce((sum, t) => sum + (trackMeta[t.id]?.fileSizeMb ?? 26.5), 0);
  }, [pinnedTracks, trackMeta]);

  const pinPct = Math.min(100, Math.round((pinnedUsedMb / driveState.offlinePinQuotaMb) * 100));

  const handleUploadAction = () => {
    const targetFolderId = currentFolderId === 'drv-root' ? 'drv-lossless' : currentFolderId;
    const targetFolder = folders.find((f) => f.id === targetFolderId);
    const addedCount = onUploadLocalTracks(targetFolderId);
    if (addedCount > 0) {
      setActionBanner(
        `Backed up ${addedCount} new local ${addedCount === 1 ? 'track' : 'tracks'} to ${targetFolder?.name ?? 'Google Drive'}.`
      );
    } else {
      setActionBanner(
        `All ${localTracks.length} local ${localTracks.length === 1 ? 'track is' : 'tracks are'} already backed up in Google Drive.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#0077b6]/35 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#caf0f8]">
            Cloud Storage (Google Drive)
          </h1>
          <p className="text-sm text-[#90e0ef]/80 mt-1.5 max-w-2xl">
            Browse your personal Drive music vault, upload local backups, offload tracks to save
            device storage, and manage pinned offline cache.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleConnectDrive}
          disabled={isTogglingConnection}
          className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            driveState.connected
              ? 'bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] border border-[#0096c7]/50'
              : 'bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e]'
          }`}
        >
          {driveState.connected ? (
            <>
              <CloudOff className="w-4 h-4" aria-hidden="true" />
              {isTogglingConnection ? 'Updating...' : 'Disconnect Google Drive'}
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4" aria-hidden="true" />
              {isTogglingConnection ? 'Connecting...' : 'Connect Google Drive'}
            </>
          )}
        </button>
      </div>

      {driveError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-400/45 text-sm text-rose-200 space-y-1"
        >
          <p className="font-semibold">Google Drive Connection Error</p>
          <p className="text-xs text-rose-200/90">{driveError}</p>
        </div>
      )}

      {actionBanner && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#00b4d8]/15 border border-[#48cae4]/45 text-sm text-[#caf0f8]"
        >
          {actionBanner}
        </div>
      )}

      {/* Offline Pin Storage Usage Bar + Upload/Offload Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section
          aria-label="Offline pin storage usage"
          className="lg:col-span-7 bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#caf0f8]">
                Offline Pin Storage Usage
              </h2>
              <p className="text-xs text-[#90e0ef]/80 mt-0.5">
                Pinned tracks stay cached locally even when other Drive files are offloaded.
              </p>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-[#caf0f8] whitespace-nowrap">
              {pinnedUsedMb.toFixed(1)} MB{' '}
              <span className="text-[#90e0ef]/70 font-normal">
                / {(driveState.offlinePinQuotaMb / 1024).toFixed(1)} GB
              </span>
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={pinPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Offline pin storage usage"
            className="h-2.5 w-full rounded-full bg-[#020326] border border-[#0077b6]/50 overflow-hidden"
          >
            <div
              className="h-full bg-[#00b4d8] transition-[width] duration-200"
              style={{ width: `${pinPct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#90e0ef]/85">
            <span className="font-mono tabular-nums">
              {pinnedTracks.length} pinned {pinnedTracks.length === 1 ? 'track' : 'tracks'} ({pinPct}% of offline budget)
            </span>
            <span className="font-mono tabular-nums text-[#90e0ef]/70">
              Drive Vault: {driveState.quotaUsedMb.toFixed(1)} MB /{' '}
              {(driveState.quotaTotalMb / 1024).toFixed(0)} GB
            </span>
          </div>

          {pinnedTracks.length > 0 && (
            <div className="pt-3 border-t border-[#0077b6]/35 space-y-1.5 max-h-52 overflow-y-auto pr-2.5 [scrollbar-gutter:stable]">
              {pinnedTracks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-1 text-xs"
                >
                  <span className="text-[#caf0f8] truncate min-w-0">
                    {t.track_name}{' '}
                    <span className="text-[#90e0ef]/70">· {t.artist}</span>
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums text-[#90e0ef]/75">
                      {(trackMeta[t.id]?.fileSizeMb ?? 26.5).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => onTogglePinOffline(t.id)}
                      aria-label={`Unpin ${t.track_name}`}
                      className="min-h-[34px] px-2.5 rounded-md text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a] flex items-center gap-1 whitespace-nowrap"
                    >
                      <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
                      Unpin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upload / Offload Controls */}
        <section
          aria-label="Upload and offload controls"
          className="lg:col-span-5 bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 flex flex-col justify-between gap-4"
        >
          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-[#caf0f8]">
              Upload & Offload
            </h2>
            <p className="text-xs text-[#90e0ef]/80 leading-relaxed">
              Back up local audio files to your connected Google Drive folder, or offload local
              copies to <span className="font-mono text-[#ade8f4]">cloud_only</span> to reclaim
              phone and laptop space.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleUploadAction}
              disabled={!driveState.connected || localTracks.length === 0}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-40 text-[#03045e] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <CloudUpload className="w-4 h-4" aria-hidden="true" />
              Upload Local Tracks to Drive ({localTracks.length})
            </button>

            {localTracks.length > 0 && driveState.connected && (
              <div className="rounded-xl bg-[#020326]/90 border border-[#0077b6]/40 p-3.5 space-y-2.5">
                <p className="text-xs font-medium text-[#90e0ef]/85">
                  Offload individual local files to Cloud Only
                </p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-2.5 [scrollbar-gutter:stable]">
                  {localTracks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-[#ade8f4] truncate min-w-0">{t.track_name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          onOffloadLocalTrack(t.id);
                          setActionBanner(`Offloaded "${t.track_name}" to Google Drive (cloud_only).`);
                        }}
                        className="min-h-[34px] px-3 rounded-md bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] font-medium whitespace-nowrap shrink-0 transition-colors"
                      >
                        Offload
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Drive Folder Browser */}
      {!driveState.connected ? (
        <section className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl py-14 px-6 text-center">
          <Cloud className="w-9 h-9 text-[#0096c7] mx-auto mb-3" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-[#caf0f8]">
            Google Drive is disconnected
          </h2>
          <p className="text-xs text-[#90e0ef]/80 mt-1 max-w-md mx-auto">
            Connect your Google Drive account to browse your personal music folders, upload
            backups, and stream or pin cloud files.
          </p>
          <button
            type="button"
            onClick={onToggleConnectDrive}
            className="mt-5 min-h-[44px] px-5 rounded-xl bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-sm font-semibold"
          >
            Connect Google Drive
          </button>
        </section>
      ) : (
        <section
          aria-label="Google Drive folder browser"
          className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl overflow-hidden"
        >
          {/* Browser Toolbar: Breadcrumbs + Cloud Search & Sort */}
          <div className="p-4 sm:p-5 border-b border-[#0077b6]/35 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId('drv-root')}
                  className={`min-h-[36px] px-2.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    currentFolderId === 'drv-root'
                      ? 'text-[#caf0f8] bg-[#023e8a]'
                      : 'text-[#90e0ef]/80 hover:text-[#caf0f8]'
                  }`}
                >
                  {driveState.rootFolderName}
                </button>
                {currentFolder && currentFolder.id !== 'drv-root' && (
                  <>
                    <ChevronRight className="w-4 h-4 text-[#0096c7] shrink-0" aria-hidden="true" />
                    <span className="font-medium text-[#caf0f8] whitespace-nowrap">
                      {currentFolder.name}
                    </span>
                  </>
                )}
              </div>

              <span className="text-xs text-[#90e0ef]/80 font-mono truncate">
                {driveState.accountEmail}
              </span>
            </div>

            {/* Folder Switcher Controls */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {folders
                .filter((f) => f.parentId === 'drv-root')
                .map((folder) => {
                  const active = currentFolderId === folder.id;
                  const count = folderCounts[folder.id] ?? 0;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className={`min-h-[40px] px-3 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#023e8a] border-[#48cae4]/60 text-[#caf0f8]'
                          : 'bg-[#020326]/70 border-[#0077b6]/40 text-[#90e0ef]/80 hover:text-[#caf0f8] hover:border-[#0096c7]'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5 text-[#48cae4]" aria-hidden="true" />
                      <span>{folder.name}</span>
                      <span className="font-mono text-[11px] tabular-nums text-[#90e0ef]/70">
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Cloud Search + Sort by Artist / Album / Date */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="w-4 h-4 text-[#90e0ef]/65 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <label htmlFor="cloud-search" className="sr-only">
                  Search Google Drive files
                </label>
                <input
                  id="cloud-search"
                  type="search"
                  value={cloudQuery}
                  onChange={(e) => setCloudQuery(e.target.value)}
                  placeholder="Filter Drive files by track, artist, or album..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#020326] border border-[#0077b6]/50 text-sm text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="cloud-sort-select" className="sr-only">
                  Sort Drive files by
                </label>
                <select
                  id="cloud-sort-select"
                  value={cloudSortBy}
                  onChange={(e) => setCloudSortBy(e.target.value as 'artist' | 'album' | 'date')}
                  className="min-h-[44px] px-3 rounded-xl bg-[#020326] border border-[#0077b6]/50 text-sm text-[#ade8f4] focus:border-[#48cae4] focus:outline-none"
                >
                  <option value="date">Sort: Date Modified</option>
                  <option value="artist">Sort: Artist</option>
                  <option value="album">Sort: Album</option>
                </select>

                <button
                  type="button"
                  onClick={() => setCloudSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={`Sort Drive files ${cloudSortDir === 'asc' ? 'ascending' : 'descending'}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-[#020326] border border-[#0077b6]/50 hover:border-[#48cae4] text-[#ade8f4] flex items-center justify-center shrink-0 transition-colors"
                >
                  {cloudSortDir === 'asc' ? (
                    <ArrowDownAZ className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ArrowUpAZ className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Subfolders list when at root */}
          {childFolders.length > 0 && currentFolderId === 'drv-root' && (
            <div className="px-4 sm:px-5 py-3 border-b border-[#0077b6]/35 bg-[#020326]/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {childFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="min-h-[52px] px-3.5 rounded-xl bg-[#03045e] border border-[#0077b6]/45 hover:border-[#48cae4]/60 flex items-center justify-between text-left transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-4 h-4 text-[#48cae4] shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-[#caf0f8] truncate">
                      {folder.name}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#90e0ef]/75">
                    {folderCounts[folder.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Drive File List */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-[#0077b6]/35 text-xs font-medium text-[#90e0ef]/80">
                  <th className="py-3 pl-5 pr-3">File / Track</th>
                  <th className="py-3 px-3">Album</th>
                  <th className="py-3 px-3 w-28 font-mono">Modified</th>
                  <th className="py-3 px-3 w-24 text-right font-mono">Size</th>
                  <th className="py-3 pl-3 pr-5 w-32 text-right">Offline Pin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0077b6]/25">
                {visibleFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-[#90e0ef]/70">
                      No Drive files match your filter in this folder.
                    </td>
                  </tr>
                ) : (
                  visibleFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-[#023e8a]/40 transition-colors">
                      <td className="py-3 pl-5 pr-3">
                        <p className="text-sm font-medium text-[#caf0f8]">{file.trackName}</p>
                        <p className="text-xs text-[#90e0ef]/80 mt-0.5">
                          {file.artist} · <span className="font-mono text-[#90e0ef]/65">{file.format}</span>
                        </p>
                      </td>
                      <td className="py-3 px-3 text-sm text-[#ade8f4]">{file.album}</td>
                      <td className="py-3 px-3 font-mono text-xs tabular-nums text-[#90e0ef]/80">
                        {file.modifiedDate}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#90e0ef]/80">
                        {file.sizeMb.toFixed(1)} MB
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => onToggleDriveFilePin(file.id)}
                          aria-pressed={file.isPinnedOffline}
                          className={`min-h-[38px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            file.isPinnedOffline
                              ? 'bg-[#00b4d8]/20 text-[#48cae4] border border-[#48cae4]/40'
                              : 'bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8]'
                          }`}
                        >
                          {file.isPinnedOffline ? (
                            <>
                              <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
                              Pinned
                            </>
                          ) : (
                            <>
                              <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                              Pin Offline
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
