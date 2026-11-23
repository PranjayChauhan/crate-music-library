/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings, Upload } from 'lucide-react';
import { CloudDriveView } from './components/CloudDriveView';
import { ImportCsvView } from './components/ImportCsvView';
import { LibraryView } from './components/LibraryView';
import { MiniPlayer } from './components/MiniPlayer';
import { OnboardingModal } from './components/OnboardingModal';
import { QueueRunnerView } from './components/QueueRunnerView';
import { SettingsModal, type AppSettings } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { AudioEngine } from './player/AudioEngine';
import { SequentialTaskRunner } from './queue/SequentialTaskRunner';
import {
  INITIAL_DRIVE_FILES,
  INITIAL_DRIVE_FOLDERS,
  INITIAL_DRIVE_STATE,
  INITIAL_PLAYLISTS,
  INITIAL_SPOTIFY_STATE,
  INITIAL_TRACK_META,
  INITIAL_TRACKS,
  LOCAL_FOLDER_OPTIONS,
  getArtworkForTrack,
  getSampleExportPayload,
  mockConnectGoogleDrive,
  mockConnectSpotifyPkce,
  mockPlaylistService,
  mockSimulateSingleTrackTransfer,
  syncImportedTracksIntoPlaylists,
} from './services/mockLibraryService';
import {
  completeSpotifyPkceCallback,
  startSpotifyPkceLogin,
} from './services/spotifyPkce';
import { GoogleDriveProvider } from './storage/GoogleDriveProvider';
import { LocalStorageProvider } from './storage/LocalStorageProvider';
import { OfflinePinStore } from './storage/OfflinePinStore';
import type {
  DriveFileItem,
  GoogleDriveState,
  ImportSummary,
  LocalFolderOption,
  NavView,
  PlaylistRecord,
  RepeatMode,
  SpotifyAccountState,
  TrackAuxMeta,
  TrackRecord,
} from './types';
import {
  computeLibraryStats,
  deduplicateTracks,
  isLocalReady,
  parseDurationToSeconds,
  parseImportedFile,
} from './utils/libraryUtils';

const STORAGE_KEYS = {
  tracks: 'crate_v1_tracks',
  playlists: 'crate_v1_playlists',
  dedupCount: 'crate_v1_dedup_count',
  settings: 'crate_v1_settings',
  onboarded: 'crate_v2_onboarded',
} as const;

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('library');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.onboarded) !== 'true';
    } catch {
      return false;
    }
  });

  const handleCloseOnboarding = () => {
    setOnboardingOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEYS.onboarded, 'true');
    } catch {
      // ignore
    }
  };

  // Persistent Settings (Spotify Client ID, Google Drive Client ID, Local Folder)
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadJsonStorage<AppSettings>(STORAGE_KEYS.settings, {
      spotifyClientId: '',
      googleDriveClientId: '',
      localFolderPath: '',
      customSearchUrlTemplate: 'https://www.google.com/search?q={query}',
    })
  );

  // Backend / Pluggable Storage Providers
  const localProviderRef = useRef<LocalStorageProvider>(new LocalStorageProvider(''));
  const driveProviderRef = useRef<GoogleDriveProvider>(
    new GoogleDriveProvider(settings.googleDriveClientId ?? '')
  );
  const [helperOnline, setHelperOnline] = useState(false);
  const [helperFolder, setHelperFolder] = useState('');
  const [scannedLocalCount, setScannedLocalCount] = useState(0);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Core Library & Playlist State (persisted in localStorage)
  const [tracks, setTracks] = useState<TrackRecord[]>(() =>
    loadJsonStorage<TrackRecord[]>(STORAGE_KEYS.tracks, INITIAL_TRACKS)
  );
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>(() =>
    loadJsonStorage<PlaylistRecord[]>(STORAGE_KEYS.playlists, INITIAL_PLAYLISTS)
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('all');
  const [trackMeta, setTrackMeta] = useState<Record<string, TrackAuxMeta>>(INITIAL_TRACK_META);
  const [deduplicatedRemovedCount, setDeduplicatedRemovedCount] = useState<number>(() =>
    loadJsonStorage<number>(STORAGE_KEYS.dedupCount, 3)
  );

  // Import & Spotify OAuth PKCE State
  const [spotifyState, setSpotifyState] = useState<SpotifyAccountState>(INITIAL_SPOTIFY_STATE);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportSummary[]>([]);

  // 1-by-1 Sequential Queue Runner State
  const folderOptions = useMemo<LocalFolderOption[]>(() => {
    if (!helperOnline || !helperFolder) return LOCAL_FOLDER_OPTIONS;
    return [
      {
        id: 'folder-local-server',
        label: 'Local Helper Folder (Active)',
        path: helperFolder,
        provider: 'local_server',
        availableGb: 250,
      },
      ...LOCAL_FOLDER_OPTIONS,
    ];
  }, [helperOnline, helperFolder]);

  const [selectedFolderId, setSelectedFolderId] = useState<string>(LOCAL_FOLDER_OPTIONS[0].id);
  const [queueRunning, setQueueRunning] = useState(false);
  const [activeDownloadTrackId, setActiveDownloadTrackId] = useState<string | null>(null);
  const [activeDownloadProgress, setActiveDownloadProgress] = useState<number>(0);
  const runnerRef = useRef<SequentialTaskRunner | null>(null);

  // Cloud Storage (Google Drive) State
  const [driveState, setDriveState] = useState<GoogleDriveState>(INITIAL_DRIVE_STATE);
  const [isTogglingDrive, setIsTogglingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>(INITIAL_DRIVE_FILES);

  // Mini-Player & Up Next Queue State
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(
    () => tracks[0]?.id ?? null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [upNextIds, setUpNextIds] = useState<string[]>(['trk-02', 'trk-03', 'trk-06']);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [usingRealAudio, setUsingRealAudio] = useState(false);
  const [outputSelectionSupported, setOutputSelectionSupported] = useState(false);
  const [activeOutputDeviceId, setActiveOutputDeviceId] = useState('default');
  const audioEngineRef = useRef<AudioEngine | null>(null);

  // Subtle transient feedback toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persist core library & settings to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.tracks, JSON.stringify(tracks));
    } catch {
      // ignore quota errors
    }
  }, [tracks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.playlists, JSON.stringify(playlists));
    } catch {
      // ignore
    }
  }, [playlists]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.dedupCount,
        JSON.stringify(deduplicatedRemovedCount)
      );
    } catch {
      // ignore
    }
  }, [deduplicatedRemovedCount]);

  useEffect(() => {
    driveProviderRef.current.setClientId(settings.googleDriveClientId);
    try {
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Probe local Express helper on startup
  useEffect(() => {
    let active = true;
    (async () => {
      const health = await localProviderRef.current.checkHealth();
      if (!active || !health?.ok) return;
      setHelperOnline(true);
      setHelperFolder(health.activeFolder);
      setSelectedFolderId('folder-local-server');
      const scanned = await localProviderRef.current.scanFolder();
      if (active) setScannedLocalCount(scanned.length);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Handle Spotify OAuth PKCE /callback redirect automatically
  useEffect(() => {
    if (window.location.pathname !== '/callback' || !window.location.search.includes('code=')) {
      return;
    }
    let active = true;
    setIsConnectingSpotify(true);
    completeSpotifyPkceCallback(window.location.search)
      .then((res) => {
        if (!active || !res) return;
        setSpotifyState(res.account);
        mergeIncomingTracks('Spotify Web API (PKCE)', res.tracks);
        window.history.replaceState({}, document.title, '/');
      })
      .catch((err) => {
        if (!active) return;
        showToast(err instanceof Error ? err.message : 'Spotify PKCE callback failed.');
        window.history.replaceState({}, document.title, '/');
      })
      .finally(() => {
        if (active) setIsConnectingSpotify(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => computeLibraryStats(tracks, deduplicatedRemovedCount),
    [tracks, deduplicatedRemovedCount]
  );

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );

  const upNextTracks = useMemo(() => {
    const map = new Map(tracks.map((t) => [t.id, t]));
    return upNextIds.map((id) => map.get(id)).filter((t): t is TrackRecord => Boolean(t));
  }, [tracks, upNextIds]);

  const pendingQueueCount = useMemo(
    () => tracks.filter((t) => t.status === 'pending' || t.status === 'downloading').length,
    [tracks]
  );

  const failedCount = useMemo(
    () => tracks.filter((t) => t.status === 'failed').length,
    [tracks]
  );

  // Initialize real HTML5 AudioEngine + Media Session API
  const nextTrackRef = useRef<() => void>(() => {});
  const prevTrackRef = useRef<() => void>(() => {});

  useEffect(() => {
    const engine = new AudioEngine(localProviderRef.current, driveProviderRef.current, {
      onTimeUpdate: (currentSec) => setElapsedSec(Math.floor(currentSec)),
      onEnded: () => {
        if (repeatMode === 'one') {
          engine.seek(0);
          void engine.play();
        } else {
          nextTrackRef.current();
        }
      },
      onPlayStateChange: (playing) => setIsPlaying(playing),
      onNext: () => nextTrackRef.current(),
      onPrev: () => prevTrackRef.current(),
      onError: (msg) => showToast(msg),
    });
    audioEngineRef.current = engine;
    setOutputSelectionSupported(engine.isOutputSelectionSupported());
    return () => {
      engine.destroy();
      audioEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load current track into AudioEngine whenever currentTrackId changes
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine || !currentTrack) {
      setUsingRealAudio(false);
      return;
    }
    let cancelled = false;
    const artwork = getArtworkForTrack(currentTrack, trackMeta);
    engine.loadTrack(currentTrack, artwork).then((real) => {
      if (cancelled) return;
      setUsingRealAudio(real);
      if (real && isPlaying) {
        void engine.play();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.media_url, currentTrack?.isPinnedOffline]);

  // Sync play/pause state to real AudioEngine
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine || !usingRealAudio) return;
    if (isPlaying) {
      void engine.play();
    } else {
      engine.pause();
    }
  }, [isPlaying, usingRealAudio]);

  // Fallback demo timer ONLY when track has no real audio file attached yet
  useEffect(() => {
    if (!isPlaying || !currentTrack || usingRealAudio) return;
    const totalSec = Math.max(1, parseDurationToSeconds(currentTrack.duration));
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => Math.min(totalSec, prev + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying, currentTrack, usingRealAudio]);

  useEffect(() => {
    if (!isPlaying || !currentTrack || usingRealAudio) return;
    const totalSec = Math.max(1, parseDurationToSeconds(currentTrack.duration));
    if (elapsedSec < totalSec) return;
    if (repeatMode === 'one') {
      setElapsedSec(0);
      return;
    }
    handleNextTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, isPlaying, currentTrack, repeatMode, usingRealAudio]);

  // Strictly 1-by-1 Sequential Queue Runner Orchestrator (real SequentialTaskRunner)
  const startQueueWithTracks = (tracksSnapshot: TrackRecord[]) => {
    if (queueRunning) {
      runnerRef.current?.updateTracks(tracksSnapshot);
      return;
    }
    const folder =
      folderOptions.find((f) => f.id === selectedFolderId) ?? folderOptions[0];

    const runner = new SequentialTaskRunner(
      tracksSnapshot,
      {
        matchLocal: async (track) => {
          const match = await localProviderRef.current.matchTrackInLocalFolder(track);
          if (match.matched) {
            return {
              matched: true,
              media_url: match.streamUrl,
              storage_provider: match.provider,
            };
          }
          return { matched: false };
        },
        downloadAuthorized: async (track, signal, onProgress) => {
          // If local helper is online and media_url is not a placeholder demo domain, do real 1-by-1 download!
          const isDemoPlaceholder = track.media_url.includes('.personal-audio.local');
          if (helperOnline && !isDemoPlaceholder) {
            onProgress(20);
            const res = await localProviderRef.current.downloadAuthorizedToLocal(track, signal);
            onProgress(100);
            setScannedLocalCount((c) => c + 1);
            return {
              media_url: res.streamUrl,
              storage_provider: 'local_server',
            };
          }

          // Graceful interactive simulation for demo placeholder URLs
          return await new Promise((resolve, reject) => {
            const cancel = mockSimulateSingleTrackTransfer(
              track,
              folder,
              (pct) => onProgress(pct),
              (res) => {
                if (res.status === 'failed') {
                  reject(new Error(res.error_message || 'Transfer failed'));
                } else {
                  resolve({
                    media_url: res.media_url ?? track.media_url,
                    storage_provider: res.storage_provider ?? folder.provider,
                  });
                }
              }
            );
            signal.addEventListener(
              'abort',
              () => {
                cancel();
                reject(new Error('Aborted'));
              },
              { once: true }
            );
          });
        },
      },
      {
        onStateChange: (state) => {
          setQueueRunning(state === 'running');
          if (state === 'completed') {
            showToast('1-by-1 sequential queue finished.');
          }
        },
        onTrackUpdate: (trackId, patch) => {
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, ...patch } : t))
          );
        },
        onProgress: (trackId, pct) => {
          setActiveDownloadTrackId(trackId);
          setActiveDownloadProgress(pct);
        },
      }
    );

    runnerRef.current = runner;
    void runner.start();
  };

  const handleStartQueue = () => {
    startQueueWithTracks(tracks);
  };

  const handlePauseQueue = () => {
    runnerRef.current?.pause();
    setQueueRunning(false);
  };

  const handleSkipCurrentDownload = () => {
    runnerRef.current?.skipCurrent();
  };

  const handleRetrySingleTrack = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    const nextTracks = tracks.map((t) =>
      t.id === trackId ? { ...t, status: 'pending' as const, error_message: undefined } : t
    );
    setTracks(nextTracks);
    startQueueWithTracks(nextTracks);
    if (track) showToast(`Retrying "${track.track_name}" in 1-by-1 runner.`);
  };

  const handleRetryFailedAll = () => {
    const nextTracks = tracks.map((t) =>
      t.status === 'failed' ? { ...t, status: 'pending' as const, error_message: undefined } : t
    );
    setTracks(nextTracks);
    startQueueWithTracks(nextTracks);
    showToast('Re-queued all failed tracks and started 1-by-1 runner.');
  };

  // Playback handlers
  const handlePlayTrack = (trackId: string) => {
    if (currentTrackId === trackId) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setCurrentTrackId(trackId);
    setElapsedSec(0);
    setIsPlaying(true);
  };

  const handleNextTrack = () => {
    if (upNextIds.length > 0) {
      const [nextId, ...rest] = upNextIds;
      setUpNextIds(rest);
      setCurrentTrackId(nextId);
      setElapsedSec(0);
      setIsPlaying(true);
      return;
    }
    if (tracks.length === 0) return;

    if (shuffle && tracks.length > 1) {
      const candidates = tracks.filter((t) => t.id !== currentTrackId);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      if (picked) {
        setCurrentTrackId(picked.id);
        setElapsedSec(0);
        setIsPlaying(true);
      }
      return;
    }

    const idx = tracks.findIndex((t) => t.id === currentTrackId);
    const nextIdx = idx + 1;
    if (nextIdx < tracks.length) {
      setCurrentTrackId(tracks[nextIdx].id);
      setElapsedSec(0);
      setIsPlaying(true);
    } else if (repeatMode === 'all') {
      setCurrentTrackId(tracks[0].id);
      setElapsedSec(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrevTrack = () => {
    if (elapsedSec > 4) {
      setElapsedSec(0);
      audioEngineRef.current?.seek(0);
      return;
    }
    if (tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrackId);
    const prevIdx = idx > 0 ? idx - 1 : tracks.length - 1;
    setCurrentTrackId(tracks[prevIdx].id);
    setElapsedSec(0);
    setIsPlaying(true);
  };

  nextTrackRef.current = handleNextTrack;
  prevTrackRef.current = handlePrevTrack;

  const handleSeek = (sec: number) => {
    setElapsedSec(sec);
    audioEngineRef.current?.seek(sec);
  };

  const handleSelectOutputDevice = async (deviceId: string, label: string) => {
    await audioEngineRef.current?.setOutputDevice(deviceId);
    setActiveOutputDeviceId(deviceId);
    showToast(`Audio output switched to ${label}.`);
  };

  const handleAddToUpNext = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    setUpNextIds((prev) => [...prev, trackId]);
    if (track) showToast(`Added "${track.track_name}" to Up Next.`);
  };

  const handleRemoveFromQueue = (indexInQueue: number) => {
    setUpNextIds((prev) => prev.filter((_, i) => i !== indexInQueue));
  };

  const handleMoveQueueItem = (indexInQueue: number, direction: 'up' | 'down') => {
    setUpNextIds((prev) => {
      const target = direction === 'up' ? indexInQueue - 1 : indexInQueue + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(indexInQueue, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  // Real IndexedDB Offline Pinning + State sync
  const handleTogglePinOffline = async (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const willPin = !track.isPinnedOffline;

    try {
      if (willPin) {
        const url = track.media_url.trim();
        if (url.startsWith('/api/local/stream/') || url.startsWith('browser-file://')) {
          const blob = await localProviderRef.current.downloadFile(url);
          await OfflinePinStore.pinAudio(track.id, blob, `${track.artist} - ${track.track_name}`);
        } else if (url.startsWith('gdrive-file://')) {
          const blob = await driveProviderRef.current.downloadFile(
            url.replace('gdrive-file://', '')
          );
          await OfflinePinStore.pinAudio(track.id, blob, `${track.artist} - ${track.track_name}`);
        }
      } else {
        await OfflinePinStore.unpinAudio(track.id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Offline cache update failed.');
    }

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isPinnedOffline: willPin } : t))
    );
    setDriveFiles((prev) =>
      prev.map((f) => (f.trackId === trackId ? { ...f, isPinnedOffline: willPin } : f))
    );
  };

  const handleSaveLocally = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || isLocalReady(track)) return;
    const nextTracks = tracks.map((t) =>
      t.id === trackId ? { ...t, status: 'pending' as const, error_message: undefined } : t
    );
    setTracks(nextTracks);
    startQueueWithTracks(nextTracks);
    showToast(`Queued "${track.track_name}" for 1-by-1 local download.`);
  };

  // Settings & Local Folder / Browser Audio File Handlers
  const handleApplyLocalFolder = async (folderPath: string) => {
    const confirmed = await localProviderRef.current.setActiveFolder(folderPath, true);
    setHelperFolder(confirmed);
    const scanned = await localProviderRef.current.scanFolder();
    setScannedLocalCount(scanned.length);
    if (scanned.length > 0) {
      const incoming: TrackRecord[] = scanned.map((f, i) => {
        const base = f.fileName.replace(/\.[^.]+$/, '');
        const parts = base.split(' - ');
        const artist = parts.length >= 2 ? parts[0].trim() : 'Local Library';
        const title = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : base;
        return {
          id: `loc-${f.id}`,
          index: i + 1,
          track_name: title,
          artist,
          album: 'Local Folder',
          duration: '3:30',
          source_url: '',
          playlist_name: 'Local Library',
          media_url: f.streamUrl,
          status: 'matched_local',
          storage_provider: 'local_server',
        };
      });
      mergeIncomingTracks('Local Music Folder Scan', incoming);
    }
  };

  const handleAddBrowserAudioFiles = (fileList: FileList) => {
    const registered = localProviderRef.current.registerBrowserFiles(fileList);
    const incoming: TrackRecord[] = registered.map((f, i) => {
      const base = f.name.replace(/\.[^.]+$/, '');
      const parts = base.split(' - ');
      const artist = parts.length >= 2 ? parts[0].trim() : 'Local File';
      const title = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : base;
      return {
        id: `bf-${f.id}`,
        index: i + 1,
        track_name: title,
        artist,
        album: 'Local Files',
        duration: '3:30',
        source_url: '',
        playlist_name: 'Local Files',
        media_url: `browser-file://${f.id}`,
        status: 'matched_local',
        storage_provider: 'local_fs',
      };
    });
    mergeIncomingTracks('Local Audio Files', incoming);
  };

  // Playlist Management handlers
  const handleCreatePlaylist = (name: string, initialTrackIds: string[] = []) => {
    const safePlaylists = Array.isArray(playlists) ? playlists : [];
    const res = mockPlaylistService.create(safePlaylists, name, initialTrackIds);
    if (res.error) return { error: res.error };
    setPlaylists(res.playlists);
    if (res.created && initialTrackIds.length > 0) {
      const idSet = new Set(initialTrackIds);
      const createdName = res.created.name;
      setTracks((prev) =>
        prev.map((t) =>
          idSet.has(t.id) && (!t.playlist_name || t.playlist_name === 'Unassigned')
            ? { ...t, playlist_name: createdName }
            : t
        )
      );
    }
    if (res.created) showToast(`Created playlist "${res.created.name}".`);
    return { created: res.created };
  };

  const handleRenamePlaylist = (playlistId: string, newName: string) => {
    const res = mockPlaylistService.rename(playlists, tracks, playlistId, newName);
    if (res.error) return { error: res.error };
    setPlaylists(res.playlists);
    setTracks(res.tracks);
    showToast(`Renamed playlist to "${newName.trim()}".`);
    return {};
  };

  const handleDeletePlaylist = (playlistId: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    const res = mockPlaylistService.remove(playlists, tracks, playlistId);
    setPlaylists(res.playlists);
    setTracks(res.tracks);
    if (selectedPlaylistId === playlistId) setSelectedPlaylistId('all');
    if (target) showToast(`Deleted playlist "${target.name}".`);
  };

  const handleToggleTrackInPlaylist = (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    const track = tracks.find((t) => t.id === trackId);
    if (!pl || !track) return;
    const alreadyIn = pl.trackIds.includes(trackId);
    const res = alreadyIn
      ? mockPlaylistService.removeTrack(playlists, tracks, playlistId, trackId)
      : mockPlaylistService.addTrack(playlists, tracks, playlistId, trackId);
    setPlaylists(res.playlists);
    setTracks(res.tracks);
    showToast(
      alreadyIn
        ? `Removed "${track.track_name}" from "${pl.name}".`
        : `Added "${track.track_name}" to "${pl.name}".`
    );
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    const track = tracks.find((t) => t.id === trackId);
    if (!pl || !track) return;
    const res = mockPlaylistService.addTrack(playlists, tracks, playlistId, trackId);
    setPlaylists(res.playlists);
    setTracks(res.tracks);
    showToast(`Added "${track.track_name}" to "${pl.name}".`);
  };

  const handlePlayPlaylist = (playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl || pl.trackIds.length === 0) return;
    const [first, ...rest] = pl.trackIds;
    setCurrentTrackId(first);
    setUpNextIds(rest);
    setElapsedSec(0);
    setIsPlaying(true);
    showToast(`Playing "${pl.name}" (${pl.trackIds.length} tracks).`);
  };

  const handleQueuePlaylist = (playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl || pl.trackIds.length === 0) return;
    setUpNextIds((prev) => [...prev, ...pl.trackIds]);
    showToast(`Added ${pl.trackIds.length} tracks from "${pl.name}" to Up Next.`);
  };

  const handleSaveQueueAsPlaylist = (name: string) => {
    const combinedIds = [...(currentTrackId ? [currentTrackId] : []), ...upNextIds];
    if (combinedIds.length === 0) return { error: 'Queue is empty.' };
    const res = mockPlaylistService.saveQueueAsPlaylist(playlists, tracks, name, combinedIds);
    if (res.error) return { error: res.error };
    setPlaylists(res.playlists);
    setTracks(res.tracks);
    if (res.created) showToast(`Saved Up Next queue as "${res.created.name}".`);
    return {};
  };

  // Import & CSV handlers
  const mergeIncomingTracks = (sourceName: string, parsedTracks: TrackRecord[]) => {
    const { merged, addedCount, duplicateCount } = deduplicateTracks(tracks, parsedTracks);
    const addedSlice = merged.slice(tracks.length);

    setTracks(merged);
    setDeduplicatedRemovedCount((prev) => prev + duplicateCount);
    setPlaylists((prev) => syncImportedTracksIntoPlaylists(prev, addedSlice));

    const today = new Date().toISOString().slice(0, 10);
    setTrackMeta((prev) => {
      const next = { ...prev };
      for (const t of addedSlice) {
        next[t.id] = {
          addedDate: today,
          fileSizeMb: 28.4,
          artworkUrl: getArtworkForTrack(t, prev),
          sourceLabel: sourceName,
        };
      }
      return next;
    });

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setImportHistory((prev) => [
      {
        sourceName,
        addedCount,
        duplicateCount,
        totalParsed: parsedTracks.length,
        timestamp,
      },
      ...prev,
    ]);
    showToast(`Imported ${addedCount} new tracks (${duplicateCount} deduplicated).`);
  };

  const handleImportRawContent = (filename: string, content: string) => {
    const parsed = parseImportedFile(filename, content);
    mergeIncomingTracks(filename, parsed);
  };

  const handleLoadSampleExport = (preset: 'spotify' | 'apple' | 'csv') => {
    const sample = getSampleExportPayload(preset);
    handleImportRawContent(sample.filename, sample.content);
  };

  const handleConnectSpotify = async (overrideClientId?: string) => {
    const rawId = typeof overrideClientId === 'string' ? overrideClientId : settings.spotifyClientId;
    const activeClientId = (rawId ?? '').trim();
    if (activeClientId) {
      setIsConnectingSpotify(true);
      try {
        await startSpotifyPkceLogin(activeClientId);
      } catch (err) {
        setIsConnectingSpotify(false);
        showToast(err instanceof Error ? err.message : 'Spotify PKCE login failed.');
      }
      return;
    }

    // Demo fallback if no Client ID configured yet
    setIsConnectingSpotify(true);
    try {
      const res = await mockConnectSpotifyPkce();
      setSpotifyState(res.account);
      mergeIncomingTracks('Spotify OAuth PKCE (Demo)', res.importedTracks);
      showToast('Demo Spotify sync complete. Add your Client ID in Settings for live OAuth.');
    } finally {
      setIsConnectingSpotify(false);
    }
  };

  const handleImportFileList = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const text = await file.text();
      handleImportRawContent(file.name, text);
    }
  };

  // Google Drive Cloud Storage handlers (real GIS OAuth if configured, demo fallback otherwise)
  const handleToggleConnectDrive = async () => {
    setIsTogglingDrive(true);
    setDriveError(null);
    try {
      if ((settings.googleDriveClientId ?? '').trim()) {
        const connected = await driveProviderRef.current.isConnected();
        if (connected) {
          await driveProviderRef.current.disconnect();
          setDriveState((prev) => ({ ...prev, connected: false }));
          showToast('Disconnected Google Drive.');
        } else {
          await driveProviderRef.current.connect();
          const remoteFiles = await driveProviderRef.current.listAudioFiles();
          const mapped: DriveFileItem[] = remoteFiles.map((rf) => ({
            id: rf.id,
            folderId: 'drv-lossless',
            fileName: rf.name,
            trackName: rf.name.replace(/\.[^.]+$/, ''),
            artist: 'Google Drive',
            album: 'Drive Audio',
            sizeMb: Number(((rf.sizeBytes ?? 0) / (1024 * 1024)).toFixed(1)),
            modifiedDate: rf.modifiedAt ?? new Date().toISOString().slice(0, 10),
            format: rf.name.toLowerCase().endsWith('.flac')
              ? 'FLAC'
              : rf.name.toLowerCase().endsWith('.m4a')
                ? 'M4A'
                : 'MP3',
            isPinnedOffline: false,
          }));
          if (mapped.length > 0) setDriveFiles(mapped);
          setDriveState((prev) => ({
            ...prev,
            connected: true,
            accountEmail: driveProviderRef.current.getAccountEmail() || prev.accountEmail,
          }));
          showToast(`Connected Google Drive (${mapped.length} audio files found).`);
        }
        return;
      }

      const next = await mockConnectGoogleDrive(driveState.connected);
      setDriveState((prev) => ({ ...next, quotaUsedMb: prev.quotaUsedMb }));
      showToast(
        next.connected
          ? 'Connected Google Drive (Demo). Add Client ID in Settings for live Drive.'
          : 'Disconnected Google Drive.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Drive connection failed.';
      setDriveError(message);
      showToast(message);
    } finally {
      setIsTogglingDrive(false);
    }
  };

  const handleUploadLocalTracksToDrive = (folderId: string): number => {
    const localList = tracks.filter((t) => isLocalReady(t));
    const existingIds = new Set(driveFiles.map((f) => f.trackId).filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);
    const additions: DriveFileItem[] = [];

    for (const t of localList) {
      if (existingIds.has(t.id)) continue;
      additions.push({
        id: `df-up-${t.id}`,
        folderId,
        trackId: t.id,
        fileName: `${t.artist} - ${t.track_name}.flac`,
        trackName: t.track_name,
        artist: t.artist,
        album: t.album,
        sizeMb: trackMeta[t.id]?.fileSizeMb ?? 32.0,
        modifiedDate: today,
        format: 'FLAC',
        isPinnedOffline: Boolean(t.isPinnedOffline),
      });
    }

    if (additions.length > 0) {
      const addedMb = additions.reduce((sum, f) => sum + f.sizeMb, 0);
      setDriveFiles((prev) => [...additions, ...prev]);
      setDriveState((prev) => ({ ...prev, quotaUsedMb: prev.quotaUsedMb + addedMb }));
    }
    return additions.length;
  };

  const handleOffloadLocalTrack = (trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              status: 'cloud_only',
              storage_provider: 'gdrive',
              media_url: `gdrive://Crate Music Vault/Offloaded Tracks/${t.artist} - ${t.track_name}.flac`,
            }
          : t
      )
    );
    if (!driveFiles.some((f) => f.trackId === trackId)) {
      const addedSize = trackMeta[trackId]?.fileSizeMb ?? 28.5;
      setDriveFiles((prev) => [
        {
          id: `df-off-${trackId}`,
          folderId: 'drv-offloaded',
          trackId,
          fileName: `${target.artist} - ${target.track_name}.flac`,
          trackName: target.track_name,
          artist: target.artist,
          album: target.album,
          sizeMb: addedSize,
          modifiedDate: new Date().toISOString().slice(0, 10),
          format: 'FLAC',
          isPinnedOffline: Boolean(target.isPinnedOffline),
        },
        ...prev,
      ]);
      setDriveState((prev) => ({ ...prev, quotaUsedMb: prev.quotaUsedMb + addedSize }));
    }
  };

  const handleToggleDriveFilePin = (fileId: string) => {
    const target = driveFiles.find((f) => f.id === fileId);
    if (!target) return;
    setDriveFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, isPinnedOffline: !f.isPinnedOffline } : f
      )
    );
    if (target.trackId) {
      void handleTogglePinOffline(target.trackId);
    }
  };

  const handleClearLibrary = () => {
    handlePauseQueue();
    setTracks([]);
    setPlaylists([]);
    setSelectedPlaylistId('all');
    setCurrentTrackId(null);
    setIsPlaying(false);
    setUpNextIds([]);
    setDeduplicatedRemovedCount(0);
    showToast('Cleared library.');
  };

  const handleRestoreDemoLibrary = () => {
    setTracks(INITIAL_TRACKS);
    setPlaylists(INITIAL_PLAYLISTS);
    setSelectedPlaylistId('all');
    setTrackMeta(INITIAL_TRACK_META);
    setCurrentTrackId(INITIAL_TRACKS[0].id);
    setUpNextIds(['trk-02', 'trk-03', 'trk-06']);
    setDeduplicatedRemovedCount(3);
    showToast('Restored sample music library.');
  };

  return (
    <div className="min-h-screen bg-[#020326] text-[#caf0f8] flex">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        playlists={playlists}
        selectedPlaylistId={selectedPlaylistId}
        onSelectPlaylist={setSelectedPlaylistId}
        onCreatePlaylist={(name) => handleCreatePlaylist(name)}
        pendingQueueCount={pendingQueueCount}
        failedCount={failedCount}
      />

      <main className="flex-1 min-w-0 overflow-x-hidden pb-32 md:pb-28">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Compact Top Status / Quick Import / Settings Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#023e8a]/85 hover:bg-[#0077b6] border border-[#0096c7]/50 text-xs font-medium text-[#caf0f8] flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#48cae4]" />
              <span>Quick Import</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#03045e]/80 hover:bg-[#023e8a] border border-[#0077b6]/50 text-xs font-medium text-[#caf0f8] flex items-center gap-2 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  helperOnline ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <Settings className="w-3.5 h-3.5 text-[#48cae4]" />
              <span>{helperOnline ? 'Local Helper Online' : 'Backend & OAuth Settings'}</span>
            </button>
          </div>

          {activeView === 'library' && (
            <LibraryView
              tracks={tracks}
              playlists={playlists}
              trackMeta={trackMeta}
              stats={stats}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              selectedPlaylistId={selectedPlaylistId}
              onSelectPlaylist={setSelectedPlaylistId}
              onPlayTrack={handlePlayTrack}
              onAddToUpNext={handleAddToUpNext}
              onTogglePinOffline={(id) => void handleTogglePinOffline(id)}
              onSaveLocally={handleSaveLocally}
              onRetryFailedTrack={handleRetrySingleTrack}
              onCreatePlaylist={handleCreatePlaylist}
              onRenamePlaylist={handleRenamePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
              onPlayPlaylist={handlePlayPlaylist}
              onQueuePlaylist={handleQueuePlaylist}
              onClearLibrary={handleClearLibrary}
              onRestoreDemoLibrary={handleRestoreDemoLibrary}
              onNavigateToImport={() => setActiveView('import')}
              customSearchUrlTemplate={settings.customSearchUrlTemplate}
            />
          )}

          {activeView === 'import' && (
            <ImportCsvView
              tracks={tracks}
              spotifyState={spotifyState}
              isConnectingSpotify={isConnectingSpotify}
              importHistory={importHistory}
              onConnectSpotify={() => void handleConnectSpotify()}
              onImportRawContent={handleImportRawContent}
              onLoadSampleExport={handleLoadSampleExport}
            />
          )}

          {activeView === 'queue' && (
            <QueueRunnerView
              tracks={tracks}
              folders={folderOptions}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              isRunning={queueRunning}
              activeTrackId={activeDownloadTrackId}
              activeProgress={activeDownloadProgress}
              onStart={handleStartQueue}
              onPause={handlePauseQueue}
              onSkipCurrent={handleSkipCurrentDownload}
              onRetryFailedAll={handleRetryFailedAll}
              onRetrySingleTrack={handleRetrySingleTrack}
            />
          )}

          {activeView === 'cloud' && (
            <CloudDriveView
              driveState={driveState}
              driveError={driveError}
              isTogglingConnection={isTogglingDrive}
              folders={INITIAL_DRIVE_FOLDERS}
              files={driveFiles}
              tracks={tracks}
              trackMeta={trackMeta}
              onToggleConnectDrive={handleToggleConnectDrive}
              onUploadLocalTracks={handleUploadLocalTracksToDrive}
              onOffloadLocalTrack={handleOffloadLocalTrack}
              onTogglePinOffline={(id) => void handleTogglePinOffline(id)}
              onToggleDriveFilePin={handleToggleDriveFilePin}
            />
          )}
        </div>
      </main>

      <OnboardingModal
        open={onboardingOpen}
        spotifyClientId={settings.spotifyClientId}
        isConnectingSpotify={isConnectingSpotify}
        onClose={handleCloseOnboarding}
        onSaveSpotifyClientId={(id) =>
          setSettings((prev) => ({ ...prev, spotifyClientId: id }))
        }
        onConnectSpotify={(overrideId) => void handleConnectSpotify(overrideId)}
        onImportFiles={handleImportFileList}
        onAddLocalAudioFiles={handleAddBrowserAudioFiles}
        onLoadSampleSpotify={() => handleLoadSampleExport('spotify')}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        helperOnline={helperOnline}
        helperFolder={helperFolder}
        scannedCount={scannedLocalCount}
        onApplyLocalFolder={handleApplyLocalFolder}
        onAddBrowserAudioFiles={handleAddBrowserAudioFiles}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-4 sm:right-6 z-50 pointer-events-none px-4 py-2.5 rounded-xl bg-[#03045e]/95 border border-[#0096c7]/70 text-xs font-medium text-[#caf0f8] shadow-xl backdrop-blur-md"
        >
          {toast}
        </div>
      )}

      <MiniPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        elapsedSec={elapsedSec}
        shuffle={shuffle}
        repeatMode={repeatMode}
        upNextTracks={upNextTracks}
        playlists={playlists}
        trackMeta={trackMeta}
        queueDrawerOpen={queueDrawerOpen}
        onToggleQueueDrawer={() => setQueueDrawerOpen((o) => !o)}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        onSeek={handleSeek}
        onToggleShuffle={() => setShuffle((s) => !s)}
        onCycleRepeat={() =>
          setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
        }
        onPlayTrack={handlePlayTrack}
        onRemoveFromQueue={handleRemoveFromQueue}
        onMoveQueueItem={handleMoveQueueItem}
        onClearQueue={() => setUpNextIds([])}
        onSaveQueueAsPlaylist={handleSaveQueueAsPlaylist}
        onAddPlaylistToQueue={handleQueuePlaylist}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
        outputSelectionSupported={outputSelectionSupported}
        activeOutputDeviceId={activeOutputDeviceId}
        onSelectOutputDevice={handleSelectOutputDevice}
      />
    </div>
  );
}
