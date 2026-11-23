import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bluetooth,
  Check,
  Cloud,
  FolderPlus,
  HardDrive,
  ListMusic,
  Pause,
  Pin,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Speaker,
  Trash2,
  X,
} from 'lucide-react';
import { AudioEngine, type AudioOutputDevice } from '../player/AudioEngine';
import type { PlaylistRecord, RepeatMode, TrackAuxMeta, TrackRecord } from '../types';
import { getArtworkForTrack } from '../services/mockLibraryService';
import {
  formatSecondsToTime,
  getTrackSourceLabel,
  parseDurationToSeconds,
} from '../utils/libraryUtils';

interface MiniPlayerProps {
  currentTrack: TrackRecord | null;
  isPlaying: boolean;
  elapsedSec: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  upNextTracks: TrackRecord[];
  playlists: PlaylistRecord[];
  trackMeta: Record<string, TrackAuxMeta>;
  queueDrawerOpen: boolean;
  onToggleQueueDrawer: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onPlayTrack: (trackId: string) => void;
  onRemoveFromQueue: (indexInQueue: number) => void;
  onMoveQueueItem: (indexInQueue: number, direction: 'up' | 'down') => void;
  onClearQueue: () => void;
  onSaveQueueAsPlaylist: (name: string) => { error?: string };
  onAddPlaylistToQueue: (playlistId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  outputSelectionSupported: boolean;
  activeOutputDeviceId: string;
  onSelectOutputDevice: (deviceId: string, label: string) => Promise<void>;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  elapsedSec,
  shuffle,
  repeatMode,
  upNextTracks,
  playlists,
  trackMeta,
  queueDrawerOpen,
  onToggleQueueDrawer,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onPlayTrack,
  onRemoveFromQueue,
  onMoveQueueItem,
  onClearQueue,
  onSaveQueueAsPlaylist,
  onAddPlaylistToQueue,
  onAddTrackToPlaylist,
  outputSelectionSupported,
  activeOutputDeviceId,
  onSelectOutputDevice,
}) => {
  const [savingQueue, setSavingQueue] = useState(false);
  const [queuePlaylistName, setQueuePlaylistName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [selectedAppendPlaylist, setSelectedAppendPlaylist] = useState('');
  const [trackPlaylistMenuId, setTrackPlaylistMenuId] = useState<string | null>(null);
  const [speakerMenuOpen, setSpeakerMenuOpen] = useState(false);
  const [outputDevices, setOutputDevices] = useState<AudioOutputDevice[]>([]);
  const [outputError, setOutputError] = useState<string | null>(null);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  useEffect(() => {
    if (!queueDrawerOpen) {
      setTrackPlaylistMenuId(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (trackPlaylistMenuId) {
          setTrackPlaylistMenuId(null);
        } else {
          onToggleQueueDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDrawerOpen, trackPlaylistMenuId, onToggleQueueDrawer]);

  const totalSec = currentTrack ? Math.max(1, parseDurationToSeconds(currentTrack.duration)) : 0;
  const clampedElapsed = Math.min(elapsedSec, totalSec);
  const progressPct = totalSec > 0 ? Math.min(100, (clampedElapsed / totalSec) * 100) : 0;
  const sourceLabel = currentTrack ? getTrackSourceLabel(currentTrack) : null;
  const artworkUrl = currentTrack ? getArtworkForTrack(currentTrack, trackMeta) : '';

  const handleSaveQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSaveQueueAsPlaylist(queuePlaylistName);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setSaveNotice(`Saved "${queuePlaylistName.trim()}" to playlists.`);
    setQueuePlaylistName('');
    setSaveError(null);
    setSavingQueue(false);
  };

  const handleAppendPlaylist = () => {
    if (!selectedAppendPlaylist) return;
    onAddPlaylistToQueue(selectedAppendPlaylist);
    setSelectedAppendPlaylist('');
  };

  const handleOpenSpeakerMenu = async () => {
    const nextOpen = !speakerMenuOpen;
    setSpeakerMenuOpen(nextOpen);
    setOutputError(null);
    if (nextOpen) {
      try {
        const list = await AudioEngine.listOutputDevices();
        setOutputDevices(list);
      } catch {
        setOutputDevices([]);
      }
    }
  };

  const handlePromptDevicePicker = async () => {
    setOutputError(null);
    try {
      const picked = await AudioEngine.promptOutputDevice();
      if (picked) {
        await onSelectOutputDevice(picked.deviceId, picked.label);
        const list = await AudioEngine.listOutputDevices();
        setOutputDevices(list);
      }
    } catch (err) {
      setOutputError(err instanceof Error ? err.message : 'Unable to switch audio output.');
    }
  };

  const renderSourceBadge = (label: 'Pinned' | 'Local' | 'Drive' | 'Pending') => {
    if (label === 'Pinned') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#48cae4]">
          <Pin className="w-3 h-3" aria-hidden="true" />
          Pinned
        </span>
      );
    }
    if (label === 'Drive') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#90e0ef]">
          <Cloud className="w-3 h-3" aria-hidden="true" />
          Drive
        </span>
      );
    }
    if (label === 'Local') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ade8f4]">
          <HardDrive className="w-3 h-3" aria-hidden="true" />
          Local
        </span>
      );
    }
    return <span className="text-[11px] text-[#90e0ef]/65">Pending</span>;
  };

  return (
    <>
      {/* Expandable Up Next Queue Drawer */}
      {queueDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:items-stretch items-end">
          <button
            type="button"
            aria-label="Close Up Next queue"
            onClick={onToggleQueueDrawer}
            className="fixed inset-0 bg-[#020326]/75 backdrop-blur-[2px]"
          />
          <section
            role="dialog"
            aria-label="Up Next Queue"
            className="relative z-10 w-full md:w-[420px] max-h-[82vh] md:h-full md:max-h-full bg-[#03045e] border-t md:border-t-0 md:border-l border-[#0077b6]/50 rounded-t-2xl md:rounded-none flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Mobile drag handle */}
            <div className="md:hidden w-10 h-1 rounded-full bg-[#0096c7]/70 mx-auto mt-2.5" aria-hidden="true" />

            <div className="px-5 py-4 border-b border-[#0077b6]/40 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#caf0f8]">
                  Up Next Queue
                </h2>
                <p className="text-xs text-[#90e0ef]/80 font-mono tabular-nums mt-0.5">
                  {upNextTracks.length} {upNextTracks.length === 1 ? 'track' : 'tracks'} queued
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {upNextTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearQueue}
                    className="min-h-[40px] px-3 rounded-lg text-xs font-medium text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleQueueDrawer}
                  aria-label="Close queue drawer"
                  className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Playlist <-> Queue Integration Bar */}
            <div className="px-5 py-3 border-b border-[#0077b6]/35 bg-[#020326]/45 space-y-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor="queue-append-playlist" className="sr-only">
                  Add playlist to Up Next queue
                </label>
                <select
                  id="queue-append-playlist"
                  value={selectedAppendPlaylist}
                  onChange={(e) => setSelectedAppendPlaylist(e.target.value)}
                  className="flex-1 min-h-[40px] px-3 rounded-lg bg-[#020326] border border-[#0077b6]/55 text-xs text-[#ade8f4] focus:border-[#48cae4] focus:outline-none"
                >
                  <option value="">Add a playlist to queue...</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({pl.trackIds.length})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAppendPlaylist}
                  disabled={!selectedAppendPlaylist}
                  className="min-h-[40px] px-3 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] disabled:opacity-40 text-xs font-medium text-[#caf0f8] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>

              {(currentTrack || upNextTracks.length > 0) && (
                <div>
                  {!savingQueue ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSavingQueue(true);
                        setSaveError(null);
                      }}
                      className="w-full min-h-[38px] px-3 rounded-lg border border-[#0077b6]/50 hover:border-[#48cae4]/60 bg-[#023e8a]/60 text-xs font-medium text-[#ade8f4] hover:text-[#caf0f8] flex items-center justify-center gap-2 transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-[#48cae4]" aria-hidden="true" />
                      Save Queue as New Playlist
                    </button>
                  ) : (
                    <form onSubmit={handleSaveQueueSubmit} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label htmlFor="save-queue-playlist-name" className="sr-only">
                          New playlist name from queue
                        </label>
                        <input
                          id="save-queue-playlist-name"
                          type="text"
                          value={queuePlaylistName}
                          onChange={(e) => {
                            setQueuePlaylistName(e.target.value);
                            if (saveError) setSaveError(null);
                          }}
                          placeholder="Name this playlist..."
                          autoFocus
                          className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#020326] border border-[#0096c7]/60 text-xs text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="min-h-[38px] px-3 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold whitespace-nowrap"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSavingQueue(false);
                            setSaveError(null);
                          }}
                          className="min-h-[38px] px-2.5 rounded-lg text-xs text-[#90e0ef] hover:text-[#caf0f8]"
                        >
                          Cancel
                        </button>
                      </div>
                      {saveError && (
                        <p className="text-xs text-rose-300" role="alert">
                          {saveError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}

              {saveNotice && (
                <p className="text-xs text-[#48cae4]" role="status">
                  {saveNotice}
                </p>
              )}
            </div>

            {/* Scrollable Queue Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {currentTrack && (
                <div>
                  <p className="text-xs font-medium text-[#90e0ef]/80 mb-2">Now Playing</p>
                  <div className="p-3 rounded-xl bg-[#023e8a]/65 border border-[#0077b6]/45 space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={artworkUrl}
                        alt={`${currentTrack.album} cover`}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-md object-cover bg-[#020326] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#48cae4] truncate">
                          {currentTrack.track_name}
                        </p>
                        <p className="text-xs text-[#ade8f4]/85 truncate">
                          {currentTrack.artist} · {currentTrack.duration}
                        </p>
                      </div>
                    </div>

                    {/* Mobile Full Transport & Interactive Seek Bar inside Drawer */}
                    <div className="md:hidden pt-2 border-t border-[#0077b6]/40 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-[#90e0ef] w-9 text-right">
                          {formatSecondsToTime(clampedElapsed)}
                        </span>
                        <input
                          type="range"
                          aria-label="Mobile seek track position"
                          min={0}
                          max={totalSec || 100}
                          value={clampedElapsed}
                          onChange={(e) => onSeek(Number(e.target.value))}
                          style={{
                            background: `linear-gradient(to right, #00b4d8 ${progressPct}%, #020326 ${progressPct}%)`,
                          }}
                          className="crate-slider flex-1 h-1 rounded-full"
                        />
                        <span className="font-mono text-[11px] tabular-nums text-[#90e0ef] w-9">
                          {currentTrack.duration}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={onToggleShuffle}
                          aria-label="Mobile toggle shuffle"
                          aria-pressed={shuffle}
                          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center ${
                            shuffle ? 'text-[#48cae4]' : 'text-[#90e0ef]/75'
                          }`}
                        >
                          <Shuffle className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onPrev}
                          aria-label="Mobile previous track"
                          className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#caf0f8]"
                        >
                          <SkipBack className="w-5 h-5 fill-current" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onTogglePlay}
                          aria-label={isPlaying ? 'Mobile pause playback' : 'Mobile play track'}
                          className="w-11 h-11 rounded-full bg-[#00b4d8] text-[#03045e] flex items-center justify-center"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={onNext}
                          aria-label="Mobile next track"
                          className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#caf0f8]"
                        >
                          <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={onCycleRepeat}
                          aria-label={`Mobile repeat mode: ${repeatMode}`}
                          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center ${
                            repeatMode !== 'off' ? 'text-[#48cae4]' : 'text-[#90e0ef]/75'
                          }`}
                        >
                          {repeatMode === 'one' ? (
                            <Repeat1 className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Repeat className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-[#90e0ef]/80 mb-2">Next Up</p>
                {upNextTracks.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-[#0077b6]/50 rounded-xl px-4">
                    <ListMusic className="w-6 h-6 text-[#0096c7] mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-[#caf0f8] font-medium">Your Up Next queue is empty</p>
                    <p className="text-xs text-[#90e0ef]/75 mt-1">
                      Add tracks from your Library or append a playlist above.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {upNextTracks.map((track, idx) => {
                      const art = getArtworkForTrack(track, trackMeta);
                      const menuOpen = trackPlaylistMenuId === `${track.id}-${idx}`;
                      const openUpward = upNextTracks.length > 2 && idx >= upNextTracks.length - 2;
                      return (
                        <li
                          key={`${track.id}-${idx}`}
                          className="relative flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#023e8a]/55 border border-transparent hover:border-[#0077b6]/45 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => onPlayTrack(track.id)}
                            aria-label={`Play ${track.track_name}`}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[44px]"
                          >
                            <img
                              src={art}
                              alt={`${track.album} cover`}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded object-cover bg-[#020326] shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#caf0f8] truncate">
                                {track.track_name}
                              </p>
                              <p className="text-xs text-[#90e0ef]/80 truncate">
                                {track.artist} · <span className="font-mono tabular-nums">{track.duration}</span>
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setTrackPlaylistMenuId(menuOpen ? null : `${track.id}-${idx}`)
                              }
                              aria-label={`Add ${track.track_name} to a playlist`}
                              className="min-h-[36px] min-w-[36px] rounded-md flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a]"
                            >
                              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveQueueItem(idx, 'up')}
                              disabled={idx === 0}
                              aria-label={`Move ${track.track_name} up`}
                              className="min-h-[36px] min-w-[36px] rounded-md flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveQueueItem(idx, 'down')}
                              disabled={idx === upNextTracks.length - 1}
                              aria-label={`Move ${track.track_name} down`}
                              className="min-h-[36px] min-w-[36px] rounded-md flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveFromQueue(idx)}
                              aria-label={`Remove ${track.track_name} from Up Next`}
                              className="min-h-[36px] min-w-[36px] rounded-md flex items-center justify-center text-[#90e0ef] hover:text-rose-300 hover:bg-[#023e8a]"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          {menuOpen && (
                            <div
                              className={`absolute right-2 z-20 w-52 p-2 rounded-xl bg-[#023e8a] border border-[#0096c7]/70 shadow-xl space-y-1 ${
                                openUpward ? 'bottom-12' : 'top-12'
                              }`}
                            >
                              <p className="px-2 py-1 text-[11px] font-medium text-[#90e0ef]">
                                Add to playlist
                              </p>
                              {playlists.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-[#90e0ef]/70">No playlists yet</p>
                              ) : (
                                playlists.map((pl) => {
                                  const alreadyIn = pl.trackIds.includes(track.id);
                                  return (
                                    <button
                                      key={pl.id}
                                      type="button"
                                      onClick={() => {
                                        onAddTrackToPlaylist(pl.id, track.id);
                                        setTrackPlaylistMenuId(null);
                                      }}
                                      className="w-full min-h-[34px] px-2 rounded-md text-left text-xs text-[#caf0f8] hover:bg-[#0077b6]/70 flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate">{pl.name}</span>
                                      {alreadyIn && (
                                        <span className="text-[11px] text-[#48cae4]">Added</span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Persistent Bottom Mini-Player */}
      <footer
        aria-label="Audio playback controls"
        className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-[#03045e]/95 backdrop-blur-md border-t border-[#0077b6]/50"
      >
        {/* Mobile thin top progress bar indicator */}
        <div className="md:hidden h-[2px] w-full bg-[#023e8a] overflow-hidden">
          <div
            className="h-full bg-[#00b4d8] transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="w-full max-w-[1600px] mx-auto px-3 md:px-4 lg:px-5 h-14 md:h-20 flex items-center justify-between gap-2 md:gap-3 lg:gap-6 overflow-hidden">
          {/* Left: Track Info + Source Badge */}
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1 md:flex-none md:w-[190px] lg:w-[240px] xl:w-[290px]">
            {currentTrack ? (
              <button
                type="button"
                onClick={onToggleQueueDrawer}
                aria-label={`Expand playback controls and Up Next for ${currentTrack.track_name}`}
                className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1 text-left min-h-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline-[#48cae4]"
              >
                <img
                  src={artworkUrl}
                  alt={`${currentTrack.album} artwork`}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-md object-cover bg-[#020326] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#caf0f8] truncate">
                    {currentTrack.track_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-[#90e0ef]/85 truncate mt-0.5">
                    <span className="truncate">{currentTrack.artist}</span>
                    {sourceLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        {renderSourceBadge(sourceLabel)}
                      </>
                    )}
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-md bg-[#020326] border border-[#0077b6]/45 flex items-center justify-center text-[#0096c7] shrink-0">
                  <ListMusic className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#ade8f4] truncate">No track selected</p>
                  <p className="text-xs text-[#90e0ef]/70 truncate">Choose a track from your library</p>
                </div>
              </div>
            )}
          </div>

          {/* Center: Transport + Interactive Seek Bar (Tablet & Desktop) */}
          <div className="hidden md:flex flex-col items-center flex-1 min-w-0 max-w-xl gap-1.5">
            <div className="flex items-center gap-1 lg:gap-2">
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label="Toggle shuffle"
                aria-pressed={shuffle}
                className={`min-h-[36px] min-w-[36px] lg:min-h-[40px] lg:min-w-[40px] rounded-full flex items-center justify-center transition-colors ${
                  shuffle
                    ? 'text-[#48cae4] bg-[#00b4d8]/20'
                    : 'text-[#90e0ef]/80 hover:text-[#caf0f8] hover:bg-[#023e8a]'
                }`}
              >
                <Shuffle className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onPrev}
                disabled={!currentTrack}
                aria-label="Previous track"
                className="min-h-[36px] min-w-[36px] lg:min-h-[40px] lg:min-w-[40px] rounded-full flex items-center justify-center text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a] disabled:opacity-40 transition-colors"
              >
                <SkipBack className="w-4 h-4 fill-current" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!currentTrack}
                aria-label={isPlaying ? 'Pause playback' : 'Play track'}
                className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] flex items-center justify-center disabled:opacity-40 transition-transform active:scale-95 shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                disabled={!currentTrack}
                aria-label="Next track"
                className="min-h-[36px] min-w-[36px] lg:min-h-[40px] lg:min-w-[40px] rounded-full flex items-center justify-center text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a] disabled:opacity-40 transition-colors"
              >
                <SkipForward className="w-4 h-4 fill-current" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={`Repeat mode: ${repeatMode}`}
                className={`min-h-[36px] min-w-[36px] lg:min-h-[40px] lg:min-w-[40px] rounded-full flex items-center justify-center transition-colors ${
                  repeatMode !== 'off'
                    ? 'text-[#48cae4] bg-[#00b4d8]/20'
                    : 'text-[#90e0ef]/80 hover:text-[#caf0f8] hover:bg-[#023e8a]'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Repeat className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="w-full min-w-0 flex items-center gap-2 lg:gap-2.5">
              <span className="font-mono text-[11px] tabular-nums text-[#90e0ef]/85 w-8 lg:w-9 text-right shrink-0">
                {formatSecondsToTime(clampedElapsed)}
              </span>
              <input
                type="range"
                aria-label="Seek track position"
                min={0}
                max={totalSec || 100}
                value={clampedElapsed}
                disabled={!currentTrack}
                onChange={(e) => onSeek(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #00b4d8 ${progressPct}%, #023e8a ${progressPct}%)`,
                }}
                className="crate-slider min-w-0 flex-1 h-1 rounded-full disabled:opacity-40"
              />
              <span className="font-mono text-[11px] tabular-nums text-[#90e0ef]/85 w-8 lg:w-9 shrink-0">
                {currentTrack ? currentTrack.duration : '0:00'}
              </span>
            </div>
          </div>

          {/* Right: Mobile Compact Controls + Up Next Drawer Toggle */}
          <div className="flex items-center gap-1 md:w-auto xl:w-[220px] justify-end shrink-0">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!currentTrack}
              aria-label={isPlaying ? 'Pause playback' : 'Play track'}
              className="md:hidden min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#caf0f8] hover:bg-[#023e8a] disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!currentTrack}
              aria-label="Next track"
              className="md:hidden min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-[#ade8f4] hover:bg-[#023e8a] disabled:opacity-40"
            >
              <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleOpenSpeakerMenu()}
              aria-expanded={speakerMenuOpen}
              aria-label="Audio output and speaker settings"
              className={`min-h-[44px] min-w-[44px] px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shrink-0 ${
                speakerMenuOpen
                  ? 'bg-[#00b4d8]/20 text-[#48cae4]'
                  : 'text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a]'
              }`}
            >
              <Speaker className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">Speaker</span>
            </button>

            <button
              type="button"
              onClick={onToggleQueueDrawer}
              aria-expanded={queueDrawerOpen}
              aria-label={`Open Up Next queue (${upNextTracks.length} tracks)`}
              className={`min-h-[44px] px-2.5 lg:px-3 rounded-lg flex items-center gap-1.5 lg:gap-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                queueDrawerOpen
                  ? 'bg-[#00b4d8]/20 text-[#48cae4]'
                  : 'text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a]'
              }`}
            >
              <ListMusic className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Up Next</span>
              <span className="font-mono tabular-nums text-[#90e0ef]">{upNextTracks.length}</span>
            </button>
          </div>
        </div>

        {/* Speaker / Output Device Popover */}
        {speakerMenuOpen && (
          <div
            role="dialog"
            aria-label="Speaker and Bluetooth output"
            className="fixed bottom-[124px] md:bottom-[92px] right-3 sm:right-6 z-50 w-[min(340px,calc(100vw-24px))] rounded-2xl bg-[#03045e] border border-[#0096c7]/60 shadow-2xl p-4 space-y-3 text-[#caf0f8]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-[#48cae4]" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Speaker &amp; Alexa Output</h3>
              </div>
              <button
                type="button"
                onClick={() => setSpeakerMenuOpen(false)}
                className="p-1 rounded-lg text-[#90e0ef] hover:bg-[#023e8a]"
                aria-label="Close speaker menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {outputError && (
              <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/35 rounded-lg px-2.5 py-2">
                {outputError}
              </p>
            )}

            {outputSelectionSupported ? (
              <div className="space-y-2">
                {outputDevices.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {outputDevices.map((dev) => {
                      const active = dev.deviceId === activeOutputDeviceId;
                      return (
                        <button
                          key={dev.deviceId}
                          type="button"
                          onClick={() => void onSelectOutputDevice(dev.deviceId, dev.label)}
                          className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                            active
                              ? 'bg-[#00b4d8]/20 border border-[#48cae4]/50 text-[#caf0f8]'
                              : 'bg-[#020326]/65 hover:bg-[#023e8a]/70 text-[#ade8f4]'
                          }`}
                        >
                          <span className="truncate">{dev.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[#48cae4] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {typeof navigator !== 'undefined' &&
                  'selectAudioOutput' in (navigator.mediaDevices ?? {}) && (
                    <button
                      type="button"
                      onClick={() => void handlePromptDevicePicker()}
                      className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold transition-colors"
                    >
                      Choose / Pair Output Speaker
                    </button>
                  )}
              </div>
            ) : (
              <div className="rounded-xl bg-[#020326]/70 border border-[#0077b6]/40 p-3 space-y-1.5 text-xs text-[#90e0ef]/90">
                <p className="font-medium text-[#caf0f8]">
                  Active Route: System / Bluetooth Output
                </p>
                <p>
                  To play on <strong>Alexa / Echo</strong> or a Bluetooth speaker from your phone:
                  say <em>&ldquo;Alexa, pair Bluetooth&rdquo;</em>, connect in your phone&apos;s
                  Bluetooth settings, and CRATE will route audio &amp; speaker buttons automatically.
                </p>
              </div>
            )}
          </div>
        )}
      </footer>
    </>
  );
};
