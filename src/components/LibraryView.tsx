import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Check,
  Cloud,
  Download,
  ExternalLink,
  FolderPlus,
  HardDrive,
  ListMusic,
  ListPlus,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  LibraryFilter,
  LibraryStats,
  PlaylistRecord,
  SortDirection,
  SortField,
  TrackAuxMeta,
  TrackRecord,
} from '../types';
import { getArtworkForTrack } from '../services/mockLibraryService';
import {
  computePlaylistAnalytics,
  filterAndSortTracks,
  getTrackSourceLabel,
  isLocalReady,
} from '../utils/libraryUtils';
import { LibraryAnalyticsModal } from './LibraryAnalyticsModal';

interface LibraryViewProps {
  tracks: TrackRecord[];
  playlists: PlaylistRecord[];
  trackMeta: Record<string, TrackAuxMeta>;
  stats: LibraryStats;
  currentTrackId: string | null;
  isPlaying: boolean;
  selectedPlaylistId: string;
  onSelectPlaylist: (playlistId: string) => void;
  onPlayTrack: (trackId: string) => void;
  onAddToUpNext: (trackId: string) => void;
  onTogglePinOffline: (trackId: string) => void;
  onSaveLocally: (trackId: string) => void;
  onRetryFailedTrack: (trackId: string) => void;
  onCreatePlaylist: (name: string, initialTrackIds?: string[]) => { error?: string; created?: PlaylistRecord };
  onRenamePlaylist: (playlistId: string, newName: string) => { error?: string };
  onDeletePlaylist: (playlistId: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onPlayPlaylist: (playlistId: string) => void;
  onQueuePlaylist: (playlistId: string) => void;
  onClearLibrary: () => void;
  onRestoreDemoLibrary: () => void;
  onNavigateToImport: () => void;
  customSearchUrlTemplate?: string;
}

const FILTER_OPTIONS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'local', label: 'Local' },
  { id: 'gdrive', label: 'Google Drive' },
  { id: 'pinned', label: 'Pinned Offline' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  playlists,
  trackMeta,
  stats,
  currentTrackId,
  isPlaying,
  selectedPlaylistId,
  onSelectPlaylist,
  onPlayTrack,
  onAddToUpNext,
  onTogglePinOffline,
  onSaveLocally,
  onRetryFailedTrack,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onToggleTrackInPlaylist,
  onPlayPlaylist,
  onQueuePlaylist,
  onClearLibrary,
  onRestoreDemoLibrary,
  onNavigateToImport,
  customSearchUrlTemplate = 'https://www.google.com/search?q={query}',
}) => {
  const buildSearchUrl = (track: TrackRecord): string | null => {
    const tpl = (customSearchUrlTemplate ?? '').trim();
    if (!tpl || (!tpl.startsWith('https://') && !tpl.startsWith('http://'))) return null;
    const queryStr = encodeURIComponent(`${track.artist ?? ''} ${track.track_name ?? ''}`.trim());
    const artistStr = encodeURIComponent((track.artist ?? '').trim());
    const trackStr = encodeURIComponent((track.track_name ?? '').trim());
    if (tpl.includes('{query}') || tpl.includes('{artist}') || tpl.includes('{track}')) {
      return tpl
        .replace(/\{query\}/g, queryStr)
        .replace(/\{artist\}/g, artistStr)
        .replace(/\{track\}/g, trackStr);
    }
    return `${tpl}${tpl.includes('?') ? '&' : '?'}q=${queryStr}`;
  };
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('index');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Playlist management UI state
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [renamingPlaylist, setRenamingPlaylist] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDeletePlaylist, setConfirmingDeletePlaylist] = useState(false);
  const [confirmingClearLib, setConfirmingClearLib] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Per-track playlist popover state
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const [quickPlaylistName, setQuickPlaylistName] = useState('');
  const [quickPlaylistError, setQuickPlaylistError] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuTrackId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuTrackId(null);
        setQuickPlaylistError(null);
      }
    };
    const handlePointerDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-playlist-popover-root="true"]')) return;
      setOpenMenuTrackId(null);
      setQuickPlaylistError(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openMenuTrackId]);

  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId]
  );

  const dateMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(trackMeta)) {
      map[id] = meta.addedDate;
    }
    return map;
  }, [trackMeta]);

  const visibleTracks = useMemo(() => {
    const playlistTrackIds = selectedPlaylist ? new Set(selectedPlaylist.trackIds) : undefined;
    return filterAndSortTracks(tracks, {
      query,
      filter,
      playlist: selectedPlaylist ? selectedPlaylist.name : 'all',
      playlistTrackIds,
      sortBy,
      sortDir,
      dateMap,
    });
  }, [tracks, query, filter, selectedPlaylist, sortBy, sortDir, dateMap]);

  const playlistAnalytics = useMemo(
    () => computePlaylistAnalytics(tracks, playlists),
    [tracks, playlists]
  );

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreatePlaylist(newPlaylistName);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    setNewPlaylistName('');
    setCreateError(null);
    setCreatingPlaylist(false);
    if (res.created) {
      onSelectPlaylist(res.created.id);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist) return;
    const res = onRenamePlaylist(selectedPlaylist.id, renameDraft);
    if (res.error) {
      setRenameError(res.error);
      return;
    }
    setRenameError(null);
    setRenamingPlaylist(false);
  };

  const handleQuickCreateAndAdd = (e: React.FormEvent, trackId: string) => {
    e.preventDefault();
    const res = onCreatePlaylist(quickPlaylistName, [trackId]);
    if (res.error) {
      setQuickPlaylistError(res.error);
      return;
    }
    setQuickPlaylistName('');
    setQuickPlaylistError(null);
    setOpenMenuTrackId(null);
  };

  const renderSourceText = (track: TrackRecord) => {
    if (track.status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Failed
        </span>
      );
    }
    const label = getTrackSourceLabel(track);
    if (label === 'Pinned') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#48cae4]">
          <Pin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Pinned
        </span>
      );
    }
    if (label === 'Drive') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#90e0ef]">
          <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Drive
        </span>
      );
    }
    if (label === 'Local') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#ade8f4]">
          <HardDrive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Local
        </span>
      );
    }
    return <span className="text-xs text-[#90e0ef]/65">Pending</span>;
  };

  const renderTrackPlaylistPopover = (track: TrackRecord, openUpward: boolean) => {
    if (openMenuTrackId !== track.id) return null;
    return (
      <div
        role="dialog"
        aria-label={`Playlists for ${track.track_name}`}
        className={`absolute right-0 z-30 w-64 rounded-xl bg-[#023e8a] border border-[#0096c7]/75 shadow-2xl p-3 space-y-2.5 text-left ${
          openUpward ? 'bottom-11' : 'top-11'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#caf0f8]">Add or remove playlist</span>
          <button
            type="button"
            onClick={() => {
              setOpenMenuTrackId(null);
              setQuickPlaylistError(null);
            }}
            aria-label="Close playlist menu"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#0077b6]/70"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-[#90e0ef]/75 py-1">No playlists yet. Create one below.</p>
          ) : (
            playlists.map((pl) => {
              const member = pl.trackIds.includes(track.id);
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => onToggleTrackInPlaylist(pl.id, track.id)}
                  className="w-full min-h-[38px] px-2.5 rounded-lg flex items-center justify-between gap-2 text-xs hover:bg-[#0077b6]/60 transition-colors"
                >
                  <span className="truncate text-[#caf0f8]">{pl.name}</span>
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      member
                        ? 'bg-[#00b4d8] border-[#00b4d8] text-[#03045e]'
                        : 'border-[#90e0ef]/50 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <form
          onSubmit={(e) => handleQuickCreateAndAdd(e, track.id)}
          className="pt-2 border-t border-[#0077b6]/60 space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <label htmlFor={`quick-pl-${track.id}`} className="sr-only">
              Create new playlist and add track
            </label>
            <input
              id={`quick-pl-${track.id}`}
              type="text"
              value={quickPlaylistName}
              onChange={(e) => {
                setQuickPlaylistName(e.target.value);
                if (quickPlaylistError) setQuickPlaylistError(null);
              }}
              placeholder="New playlist..."
              className="flex-1 min-w-0 h-8 px-2.5 rounded-md bg-[#020326] border border-[#0096c7]/60 text-xs text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 px-2.5 rounded-md bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold shrink-0"
            >
              Add
            </button>
          </div>
          {quickPlaylistError && (
            <p className="text-[11px] text-rose-300" role="alert">
              {quickPlaylistError}
            </p>
          )}
        </form>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Centered Library Header + Centered Search Bar */}
      <header className="flex flex-col items-center text-center gap-4 pt-1">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#caf0f8]">
            {selectedPlaylist ? selectedPlaylist.name : 'Music Library'}
          </h1>
          {selectedPlaylist && (
            <p className="text-sm text-[#90e0ef]/80 mt-1">
              Custom playlist · {selectedPlaylist.trackIds.length}{' '}
              {selectedPlaylist.trackIds.length === 1 ? 'track' : 'tracks'} · Updated{' '}
              {selectedPlaylist.updatedAt}
            </p>
          )}
        </div>

        {/* Centered Search Input directly under Music Library */}
        <div className="relative w-full max-w-2xl">
          <Search
            className="w-4 h-4 text-[#90e0ef]/70 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="library-search" className="sr-only">
            Search tracks by title, artist, album, or playlist
          </label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, albums..."
            className="w-full min-h-[46px] pl-11 pr-4 rounded-xl bg-[#03045e]/90 border border-[#0077b6]/55 text-sm text-[#caf0f8] placeholder:text-[#90e0ef]/55 focus:border-[#48cae4] focus:outline-none shadow-sm"
          />
        </div>
      </header>

      {/* Controls Bar: Playlist Dropdown, Sort, Availability Filters, and Library Actions */}
      <section aria-label="Filter, sort, and manage library" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* Playlist Dropdown + Sort */}
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <label htmlFor="playlist-filter-select" className="sr-only">
              Filter by playlist
            </label>
            <select
              id="playlist-filter-select"
              value={selectedPlaylistId}
              onChange={(e) => {
                onSelectPlaylist(e.target.value);
                setRenamingPlaylist(false);
                setConfirmingDeletePlaylist(false);
              }}
              className="flex-1 min-w-0 sm:flex-none sm:min-w-[180px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-[#03045e]/85 border border-[#0077b6]/45 text-xs sm:text-sm text-[#ade8f4] focus:border-[#48cae4] focus:outline-none"
            >
              <option value="all">All Playlists ({tracks.length})</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.trackIds.length})
                </option>
              ))}
            </select>

            <label htmlFor="library-sort-select" className="sr-only">
              Sort tracks by
            </label>
            <select
              id="library-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="min-w-0 w-[132px] sm:w-auto min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-[#03045e]/85 border border-[#0077b6]/45 text-xs sm:text-sm text-[#ade8f4] focus:border-[#48cae4] focus:outline-none"
            >
              <option value="index">Sort: Default</option>
              <option value="artist">Sort: Artist</option>
              <option value="album">Sort: Album</option>
              <option value="date">Sort: Date</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#03045e]/85 border border-[#0077b6]/45 hover:border-[#48cae4] text-[#ade8f4] hover:text-[#caf0f8] flex items-center justify-center transition-colors shrink-0"
            >
              {sortDir === 'asc' ? (
                <ArrowDownAZ className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ArrowUpAZ className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Primary Actions: Analytics, New Playlist, Clear Library */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAnalyticsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={analyticsOpen}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#023e8a] hover:bg-[#0077b6] border border-[#0096c7]/55 text-[#caf0f8] text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4 text-[#48cae4] shrink-0" aria-hidden="true" />
              <span>Analytics</span>
              <span className="font-mono text-xs tabular-nums text-[#90e0ef] border-l border-[#0096c7]/45 pl-2">
                {stats.localReadyCount}/{stats.cloudReadyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCreatingPlaylist((prev) => !prev);
                setCreateError(null);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              New Playlist
            </button>

            {tracks.length > 0 && !confirmingClearLib && (
              <button
                type="button"
                onClick={() => setConfirmingClearLib(true)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#0077b6]/50 hover:border-[#48cae4]/60 text-xs font-medium text-[#90e0ef] hover:text-[#caf0f8] transition-colors whitespace-nowrap"
              >
                Clear Library
              </button>
            )}

            {confirmingClearLib && (
              <div className="flex items-center gap-1.5 bg-[#03045e] border border-rose-500/45 rounded-xl px-2.5 py-1">
                <span className="text-xs text-[#caf0f8]">Clear all?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearLibrary();
                    setConfirmingClearLib(false);
                  }}
                  className="min-h-[34px] px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClearLib(false)}
                  className="min-h-[34px] px-2 rounded text-xs text-[#90e0ef] hover:text-[#caf0f8]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Filter Segmented Control */}
        <div
          role="group"
          aria-label="Filter tracks by availability"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                aria-pressed={active}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#caf0f8] text-[#03045e] font-semibold'
                    : 'bg-[#03045e]/85 text-[#90e0ef] hover:text-[#caf0f8] border border-[#0077b6]/45'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* New Playlist Modal Dialog (reliable on desktop & mobile touchscreens) */}
      {creatingPlaylist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#020326]/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create a new playlist"
        >
          <form
            onSubmit={handleCreatePlaylistSubmit}
            className="w-full max-w-md bg-[#03045e] border border-[#0096c7]/65 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#caf0f8]">
                Create New Playlist
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCreatingPlaylist(false);
                  setCreateError(null);
                }}
                aria-label="Close create playlist dialog"
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label
                htmlFor="library-new-playlist-input"
                className="block text-xs font-medium text-[#90e0ef]/85 mb-1.5"
              >
                Playlist Name
              </label>
              <input
                id="library-new-playlist-input"
                type="text"
                value={newPlaylistName}
                onChange={(e) => {
                  setNewPlaylistName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                placeholder="e.g., Sunday Vinyl, Workout Mix..."
                autoFocus
                className="w-full min-h-[44px] px-3.5 rounded-lg bg-[#020326] border border-[#0077b6]/65 text-sm text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
              />
              {createError && (
                <p className="text-xs text-rose-300 mt-1.5" role="alert">
                  {createError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCreatingPlaylist(false);
                  setCreateError(null);
                }}
                className="min-h-[44px] px-4 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-sm font-medium whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-sm font-semibold whitespace-nowrap"
              >
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Playlist Controls (when viewing a specific playlist) */}
      {selectedPlaylist && (
        <section
          aria-label="Selected playlist controls"
          className="bg-[#03045e]/90 border border-[#0077b6]/45 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          {renamingPlaylist ? (
            <form onSubmit={handleRenameSubmit} className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor="rename-playlist-input" className="sr-only">
                  Rename playlist
                </label>
                <input
                  id="rename-playlist-input"
                  type="text"
                  value={renameDraft}
                  onChange={(e) => {
                    setRenameDraft(e.target.value);
                    if (renameError) setRenameError(null);
                  }}
                  autoFocus
                  className="w-full min-h-[42px] px-3 rounded-lg bg-[#020326] border border-[#0077b6]/65 text-sm text-[#caf0f8] focus:border-[#48cae4] focus:outline-none"
                />
                {renameError && (
                  <p className="text-xs text-rose-300 mt-1" role="alert">
                    {renameError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold"
                >
                  Save Name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingPlaylist(false);
                    setRenameError(null);
                  }}
                  className="min-h-[42px] px-3 rounded-lg bg-[#023e8a] text-[#caf0f8] text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlayPlaylist(selectedPlaylist.id)}
                  disabled={selectedPlaylist.trackIds.length === 0}
                  className="min-h-[42px] px-4 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-40 text-[#03045e] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  Play Playlist
                </button>
                <button
                  type="button"
                  onClick={() => onQueuePlaylist(selectedPlaylist.id)}
                  disabled={selectedPlaylist.trackIds.length === 0}
                  className="min-h-[42px] px-3.5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] disabled:opacity-40 text-[#caf0f8] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Queue All
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenameDraft(selectedPlaylist.name);
                    setRenameError(null);
                    setRenamingPlaylist(true);
                    setConfirmingDeletePlaylist(false);
                  }}
                  className="min-h-[42px] px-3.5 rounded-lg border border-[#0077b6]/55 hover:border-[#48cae4]/60 bg-[#020326]/65 text-xs font-medium text-[#ade8f4] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  Rename
                </button>

                {!confirmingDeletePlaylist ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeletePlaylist(true)}
                    className="min-h-[42px] px-3.5 rounded-lg border border-[#0077b6]/55 hover:border-rose-500/50 bg-[#020326]/65 text-xs font-medium text-[#ade8f4] hover:text-rose-300 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete Playlist
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-[#020326] border border-rose-500/45 rounded-lg px-2.5 py-1">
                    <span className="text-xs text-[#caf0f8]">Delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePlaylist(selectedPlaylist.id);
                        setConfirmingDeletePlaylist(false);
                      }}
                      className="min-h-[34px] px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeletePlaylist(false)}
                      className="min-h-[34px] px-2 rounded text-xs text-[#90e0ef] hover:text-[#caf0f8]"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onSelectPlaylist('all');
                    setRenamingPlaylist(false);
                    setConfirmingDeletePlaylist(false);
                  }}
                  className="min-h-[42px] px-3 rounded-lg text-xs text-[#90e0ef] hover:text-[#caf0f8] whitespace-nowrap"
                >
                  All Tracks
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Empty Library State vs Filtered Empty vs Populated Track List */}
      {tracks.length === 0 ? (
        <section
          aria-label="Empty library state"
          className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl py-16 px-6 text-center max-w-2xl mx-auto"
        >
          <ListMusic className="w-10 h-10 text-[#0096c7] mx-auto mb-3" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-[#caf0f8]">
            Your personal library is empty
          </h2>
          <p className="text-sm text-[#90e0ef]/80 mt-1.5 max-w-md mx-auto">
            Import official Spotify or Apple Music exports, add authorized local audio files, or
            load the sample catalog to explore Crate.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateToImport}
              className="min-h-[44px] px-5 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Import Library
            </button>
            <button
              type="button"
              onClick={onRestoreDemoLibrary}
              className="min-h-[44px] px-5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-sm font-medium transition-colors whitespace-nowrap"
            >
              Load Sample Library
            </button>
          </div>
        </section>
      ) : visibleTracks.length === 0 ? (
        <section
          aria-label="No matching tracks"
          className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl py-14 px-6 text-center"
        >
          <p className="font-display text-base font-semibold text-[#caf0f8]">
            No tracks match your current filter
          </p>
          <p className="text-xs text-[#90e0ef]/80 mt-1">
            {selectedPlaylist && selectedPlaylist.trackIds.length === 0
              ? `"${selectedPlaylist.name}" has no tracks yet. Switch to All Tracks to add songs to this playlist.`
              : 'Try adjusting your search terms, availability filter, or playlist selection.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
              onSelectPlaylist('all');
            }}
            className="mt-4 min-h-[44px] px-4 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-xs font-medium"
          >
            Reset Filters
          </button>
        </section>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden xl:block bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#0077b6]/35 text-xs font-medium text-[#90e0ef]/80">
                  <th className="py-3.5 pl-4 pr-2 w-12 font-mono">#</th>
                  <th className="py-3.5 px-3">Track</th>
                  <th className="py-3.5 px-3">Album</th>
                  <th className="py-3.5 px-3 w-32">Source</th>
                  <th className="py-3.5 px-3 w-20 text-right font-mono">Time</th>
                  <th className="py-3.5 pl-3 pr-4 w-[310px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0077b6]/25">
                {visibleTracks.map((track, rowIdx) => {
                  const active = currentTrackId === track.id;
                  const local = isLocalReady(track);
                  const downloading = track.status === 'downloading';
                  const art = getArtworkForTrack(track, trackMeta);
                  const openUpward = visibleTracks.length > 3 && rowIdx >= visibleTracks.length - 2;

                  return (
                    <tr
                      key={track.id}
                      className={`group transition-colors ${
                        active ? 'bg-[#023e8a]/75' : 'hover:bg-[#023e8a]/40'
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2">
                        <button
                          type="button"
                          onClick={() => onPlayTrack(track.id)}
                          aria-label={
                            active && isPlaying
                              ? `Pause ${track.track_name}`
                              : `Play ${track.track_name}`
                          }
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            active
                              ? 'bg-[#00b4d8] text-[#03045e]'
                              : 'text-[#90e0ef] hover:bg-[#0077b6]/60 hover:text-[#caf0f8]'
                          }`}
                        >
                          {active && isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 max-w-[300px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={art}
                            alt={`${track.album} artwork`}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded object-cover bg-[#020326] shrink-0"
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                active ? 'text-[#48cae4]' : 'text-[#caf0f8]'
                              }`}
                            >
                              {track.track_name}
                            </p>
                            <p className="text-xs text-[#90e0ef]/85 truncate mt-0.5">
                              {track.artist}
                              <span aria-hidden="true"> · </span>
                              <span className="text-[#90e0ef]/65">{track.playlist_name}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 max-w-[200px]">
                        <p className="text-sm text-[#ade8f4] truncate">{track.album}</p>
                        <p className="text-xs font-mono tabular-nums text-[#90e0ef]/65 mt-0.5">
                          {trackMeta[track.id]?.addedDate ?? '2026-11-21'}
                        </p>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {renderSourceText(track)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-[#90e0ef]/80">
                        {track.duration}
                      </td>

                      <td className="py-2.5 pl-3 pr-4">
                        <div
                          data-playlist-popover-root="true"
                          className="relative flex items-center justify-end gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => onAddToUpNext(track.id)}
                            aria-label={`Add ${track.track_name} to Up Next`}
                            title="Add to Up Next"
                            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors"
                          >
                            <ListPlus className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuTrackId((prev) => (prev === track.id ? null : track.id));
                              setQuickPlaylistError(null);
                            }}
                            aria-label={`Manage playlists for ${track.track_name}`}
                            title="Add or remove from playlists"
                            className={`min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center transition-colors ${
                              openMenuTrackId === track.id
                                ? 'bg-[#023e8a] text-[#48cae4]'
                                : 'text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a]'
                            }`}
                          >
                            <FolderPlus className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onTogglePinOffline(track.id)}
                            aria-label={
                              track.isPinnedOffline
                                ? `Unpin ${track.track_name} from offline cache`
                                : `Pin ${track.track_name} offline`
                            }
                            aria-pressed={Boolean(track.isPinnedOffline)}
                            title={track.isPinnedOffline ? 'Pinned Offline' : 'Pin Offline'}
                            className={`min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center transition-colors ${
                              track.isPinnedOffline
                                ? 'text-[#48cae4] bg-[#00b4d8]/20'
                                : 'text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a]'
                            }`}
                          >
                            {track.isPinnedOffline ? (
                              <PinOff className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Pin className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>

                          {track.status === 'failed' ? (
                            <button
                              type="button"
                              onClick={() => onRetryFailedTrack(track.id)}
                              className="min-h-[38px] px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                            >
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                              Retry
                            </button>
                          ) : selectedPlaylist ? (
                            <button
                              type="button"
                              onClick={() => onToggleTrackInPlaylist(selectedPlaylist.id, track.id)}
                              aria-label={`Remove ${track.track_name} from ${selectedPlaylist.name}`}
                              className="min-h-[38px] px-2.5 rounded-lg border border-[#0077b6]/55 hover:border-rose-500/45 text-[#90e0ef] hover:text-rose-300 text-xs font-medium whitespace-nowrap"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSaveLocally(track.id)}
                              disabled={local || downloading}
                              aria-label={
                                local
                                  ? `${track.track_name} saved locally`
                                  : downloading
                                    ? `${track.track_name} downloading`
                                    : `Save ${track.track_name} locally`
                              }
                              className={`min-h-[38px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                                local || downloading
                                  ? 'text-[#90e0ef]/55 cursor-default'
                                  : 'bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8]'
                              }`}
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              {local ? 'Saved' : downloading ? 'Saving...' : 'Save Locally'}
                            </button>
                          )}

                          {!local && (() => {
                            const searchHref = buildSearchUrl(track);
                            if (!searchHref) return null;
                            return (
                              <a
                                href={searchHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Search web for ${track.track_name}`}
                                title="Search on web"
                                className="min-h-[38px] px-2.5 rounded-lg border border-[#0077b6]/55 hover:border-[#48cae4]/65 text-[#90e0ef] hover:text-[#caf0f8] text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                              >
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                Search
                              </a>
                            );
                          })()}

                          {renderTrackPlaylistPopover(track, openUpward)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Touch-First Cards (44px+ touch targets) */}
          <div className="xl:hidden space-y-2.5">
            {visibleTracks.map((track, rowIdx) => {
              const active = currentTrackId === track.id;
              const local = isLocalReady(track);
              const downloading = track.status === 'downloading';
              const art = getArtworkForTrack(track, trackMeta);
              const openUpward = visibleTracks.length > 2 && rowIdx >= visibleTracks.length - 2;

              return (
                <article
                  key={track.id}
                  className={`relative bg-[#03045e]/85 border rounded-2xl p-3.5 space-y-3 ${
                    active ? 'border-[#48cae4]/65' : 'border-[#0077b6]/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track.id)}
                      aria-label={
                        active && isPlaying
                          ? `Pause ${track.track_name}`
                          : `Play ${track.track_name}`
                      }
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 focus-visible:outline-2 focus-visible:outline-[#48cae4]"
                    >
                      <img
                        src={art}
                        alt={`${track.album} artwork`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover bg-[#020326]"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center transition-colors ${
                          active ? 'bg-[#020326]/65 text-[#48cae4]' : 'bg-[#020326]/40 text-[#caf0f8]'
                        }`}
                      >
                        {active && isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold truncate ${
                          active ? 'text-[#48cae4]' : 'text-[#caf0f8]'
                        }`}
                      >
                        {track.track_name}
                      </p>
                      <p className="text-xs text-[#90e0ef]/85 truncate mt-0.5">
                        {track.artist} · {track.album}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#90e0ef]/70">
                        {renderSourceText(track)}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{track.duration}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    data-playlist-popover-root="true"
                    className="relative flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#0077b6]/35"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onAddToUpNext(track.id)}
                        aria-label={`Add ${track.track_name} to Up Next`}
                        className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[#ade8f4] hover:bg-[#023e8a]"
                      >
                        <ListPlus className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuTrackId((prev) => (prev === track.id ? null : track.id));
                          setQuickPlaylistError(null);
                        }}
                        aria-label={`Manage playlists for ${track.track_name}`}
                        className={`min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center ${
                          openMenuTrackId === track.id
                            ? 'bg-[#023e8a] text-[#48cae4]'
                            : 'text-[#ade8f4] hover:bg-[#023e8a]'
                        }`}
                      >
                        <FolderPlus className="w-4 h-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onTogglePinOffline(track.id)}
                        aria-label={
                          track.isPinnedOffline
                            ? `Unpin ${track.track_name}`
                            : `Pin ${track.track_name} offline`
                        }
                        aria-pressed={Boolean(track.isPinnedOffline)}
                        className={`min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center ${
                          track.isPinnedOffline
                            ? 'text-[#48cae4] bg-[#00b4d8]/20'
                            : 'text-[#ade8f4] hover:bg-[#023e8a]'
                        }`}
                      >
                        {track.isPinnedOffline ? (
                          <PinOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Pin className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {track.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => onRetryFailedTrack(track.id)}
                        className="min-h-[44px] px-3.5 rounded-lg bg-rose-500/15 text-rose-200 text-xs font-medium flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        Retry
                      </button>
                    ) : selectedPlaylist ? (
                      <button
                        type="button"
                        onClick={() => onToggleTrackInPlaylist(selectedPlaylist.id, track.id)}
                        className="min-h-[44px] px-3.5 rounded-lg border border-[#0077b6]/55 text-[#ade8f4] text-xs font-medium"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSaveLocally(track.id)}
                        disabled={local || downloading}
                        className={`min-h-[44px] px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                          local || downloading
                            ? 'text-[#90e0ef]/55 bg-[#020326]/55'
                            : 'bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8]'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        {local ? 'Saved Locally' : downloading ? 'Saving...' : 'Save Locally'}
                      </button>
                    )}

                    {!local && (() => {
                      const searchHref = buildSearchUrl(track);
                      if (!searchHref) return null;
                      return (
                        <a
                          href={searchHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-3.5 rounded-lg border border-[#0077b6]/55 text-[#90e0ef] hover:text-[#caf0f8] text-xs font-medium flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          Search
                        </a>
                      );
                    })()}

                    {renderTrackPlaylistPopover(track, openUpward)}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Library Analytics Modal */}
      <LibraryAnalyticsModal
        open={analyticsOpen}
        stats={stats}
        playlistCount={playlists.length}
        playlistAnalytics={playlistAnalytics}
        onClose={() => setAnalyticsOpen(false)}
        onSelectPlaylist={(playlistId) => {
          onSelectPlaylist(playlistId);
          setRenamingPlaylist(false);
          setConfirmingDeletePlaylist(false);
        }}
      />
    </div>
  );
};
