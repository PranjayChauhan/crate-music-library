import type { StorageProvider, TrackRecord } from '../types';
import { isDirectAuthorizedMediaUrl } from '../utils/filenameSanitizer';

export interface LocalMatchResult {
  matched: boolean;
  media_url?: string;
  storage_provider?: StorageProvider;
}

export interface DownloadResult {
  media_url: string;
  storage_provider: StorageProvider;
}

export interface SequentialTaskResolver {
  matchLocal(track: TrackRecord): Promise<LocalMatchResult>;
  downloadAuthorized(
    track: TrackRecord,
    signal: AbortSignal,
    onProgress: (percent: number) => void
  ): Promise<DownloadResult>;
}

export type RunnerState = 'idle' | 'running' | 'paused' | 'completed';

export interface SequentialRunnerCallbacks {
  onStateChange?: (state: RunnerState) => void;
  onTrackUpdate?: (trackId: string, patch: Partial<TrackRecord>) => void;
  onProgress?: (trackId: string | null, percent: number) => void;
}

/**
 * Strictly 1-by-1 sequential task runner (concurrency === 1).
 * Processes pending tracks one row at a time:
 * 1) Attempts local folder match first.
 * 2) Otherwise validates and downloads direct authorized `media_url`.
 * 3) Otherwise marks track as `skipped`.
 */
export class SequentialTaskRunner {
  private tracks: TrackRecord[];
  private resolver: SequentialTaskResolver;
  private callbacks: SequentialRunnerCallbacks;
  private state: RunnerState = 'idle';
  private activeTrackId: string | null = null;
  private activeAbort: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private skipRequested = false;

  constructor(
    tracks: TrackRecord[],
    resolver: SequentialTaskResolver,
    callbacks: SequentialRunnerCallbacks = {}
  ) {
    this.tracks = tracks.map((t) => ({ ...t }));
    this.resolver = resolver;
    this.callbacks = callbacks;
  }

  public getState(): RunnerState {
    return this.state;
  }

  public getTracks(): TrackRecord[] {
    return this.tracks.map((t) => ({ ...t }));
  }

  public getActiveTrackId(): string | null {
    return this.activeTrackId;
  }

  public updateTracks(tracks: TrackRecord[]): void {
    this.tracks = tracks.map((t) => ({ ...t }));
  }

  private setState(next: RunnerState): void {
    this.state = next;
    this.callbacks.onStateChange?.(next);
  }

  private patchTrack(trackId: string, patch: Partial<TrackRecord>): void {
    this.tracks = this.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t));
    this.callbacks.onTrackUpdate?.(trackId, patch);
  }

  public start(): Promise<void> {
    if (this.state === 'running' && this.loopPromise) {
      return this.loopPromise;
    }
    this.setState('running');
    this.loopPromise = this.runLoop();
    return this.loopPromise;
  }

  public pause(): void {
    if (this.state !== 'running') return;
    this.setState('paused');
    this.skipRequested = false;
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    if (this.activeTrackId) {
      this.patchTrack(this.activeTrackId, { status: 'pending' });
      this.activeTrackId = null;
      this.callbacks.onProgress?.(null, 0);
    }
  }

  public skipCurrent(): void {
    if (!this.activeTrackId) return;
    this.skipRequested = true;
    if (this.activeAbort) {
      this.activeAbort.abort();
    }
  }

  public retryFailed(): void {
    for (const track of this.tracks) {
      if (track.status === 'failed') {
        this.patchTrack(track.id, { status: 'pending', error_message: undefined });
      }
    }
  }

  private async runLoop(): Promise<void> {
    while (this.state === 'running') {
      const next = this.tracks.find((t) => t.status === 'pending');
      if (!next) {
        this.activeTrackId = null;
        this.callbacks.onProgress?.(null, 0);
        this.setState('completed');
        return;
      }

      this.activeTrackId = next.id;
      this.skipRequested = false;
      this.callbacks.onProgress?.(next.id, 0);
      this.patchTrack(next.id, { status: 'downloading', error_message: undefined });

      const controller = new AbortController();
      this.activeAbort = controller;

      try {
        // 1. Check local folder match first
        const localMatch = await this.resolver.matchLocal(next);
        if (this.state !== 'running' && !this.skipRequested) {
          return;
        }
        if (this.skipRequested) {
          this.patchTrack(next.id, {
            status: 'skipped',
            error_message: 'Skipped by user during queue run',
          });
          continue;
        }

        if (localMatch.matched) {
          this.callbacks.onProgress?.(next.id, 100);
          this.patchTrack(next.id, {
            status: 'matched_local',
            media_url: localMatch.media_url ?? next.media_url,
            storage_provider: localMatch.storage_provider ?? 'local_server',
            error_message: undefined,
          });
          continue;
        }

        // 2. Validate authorized direct media_url
        if (!next.media_url || !next.media_url.trim()) {
          this.patchTrack(next.id, {
            status: 'skipped',
            error_message: 'No local match and no authorized direct media_url supplied',
          });
          continue;
        }

        const validation = isDirectAuthorizedMediaUrl(next.media_url);
        if (!validation.valid) {
          this.patchTrack(next.id, {
            status: 'failed',
            error_message: validation.reason ?? 'Invalid media_url',
          });
          continue;
        }

        // 3. Download sequentially (strictly 1-by-1)
        const result = await this.resolver.downloadAuthorized(
          next,
          controller.signal,
          (pct) => {
            if (this.activeTrackId === next.id) {
              this.callbacks.onProgress?.(next.id, Math.max(0, Math.min(100, Math.round(pct))));
            }
          }
        );

        this.callbacks.onProgress?.(next.id, 100);
        this.patchTrack(next.id, {
          status: 'downloaded',
          media_url: result.media_url,
          storage_provider: result.storage_provider,
          error_message: undefined,
        });
      } catch (err) {
        if (this.skipRequested) {
          this.patchTrack(next.id, {
            status: 'skipped',
            error_message: 'Skipped by user during queue run',
          });
        } else if (this.getState() === 'paused') {
          this.patchTrack(next.id, { status: 'pending' });
          return;
        } else {
          const message =
            err instanceof Error ? err.message : 'Download failed for authorized media_url';
          this.patchTrack(next.id, {
            status: 'failed',
            error_message: message,
          });
        }
      } finally {
        this.activeAbort = null;
        this.activeTrackId = null;
        this.callbacks.onProgress?.(null, 0);
      }
    }
  }
}
