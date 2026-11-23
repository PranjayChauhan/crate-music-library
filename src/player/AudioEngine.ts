import type { TrackRecord } from '../types';
import { GoogleDriveProvider } from '../storage/GoogleDriveProvider';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import { OfflinePinStore } from '../storage/OfflinePinStore';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

export interface AudioEngineCallbacks {
  onTimeUpdate: (currentSec: number, durationSec: number) => void;
  onEnded: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onError?: (message: string) => void;
}

/**
 * Real HTML5 <audio> playback engine with:
 * - Priority source resolution: IndexedDB Pinned Blob -> Local Helper/Browser File -> Authorized URL -> Google Drive
 * - Media Session API integration for mobile lock-screen & headphone controls
 * - Graceful demo-mode indicator when a track has no real audio stream attached yet
 */
export class AudioEngine {
  private audio: HTMLAudioElement;
  private localProvider: LocalStorageProvider;
  private driveProvider: GoogleDriveProvider;
  private callbacks: AudioEngineCallbacks;
  private currentRevoke: (() => void) | null = null;
  private activeTrackId: string | null = null;
  private hasRealAudio = false;

  constructor(
    localProvider: LocalStorageProvider,
    driveProvider: GoogleDriveProvider,
    callbacks: AudioEngineCallbacks
  ) {
    this.localProvider = localProvider;
    this.driveProvider = driveProvider;
    this.callbacks = callbacks;
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    this.audio.addEventListener('timeupdate', () => {
      if (!this.hasRealAudio) return;
      const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      this.callbacks.onTimeUpdate(this.audio.currentTime, dur);
    });

    this.audio.addEventListener('ended', () => {
      if (!this.hasRealAudio) return;
      this.callbacks.onEnded();
    });

    this.audio.addEventListener('play', () => {
      if (this.hasRealAudio) this.callbacks.onPlayStateChange(true);
    });

    this.audio.addEventListener('pause', () => {
      if (this.hasRealAudio) this.callbacks.onPlayStateChange(false);
    });

    this.audio.addEventListener('error', () => {
      if (this.hasRealAudio) {
        this.callbacks.onError?.('Unable to decode or reach audio stream for this track.');
      }
    });

    this.bindMediaSessionHandlers();
  }

  private bindMediaSessionHandlers(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => {
        void this.play();
      });
      ms.setActionHandler('pause', () => {
        this.pause();
      });
      ms.setActionHandler('previoustrack', () => {
        this.callbacks.onPrev();
      });
      ms.setActionHandler('nexttrack', () => {
        this.callbacks.onNext();
      });
      ms.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seek(details.seekTime);
        }
      });
    } catch {
      // Some browsers restrict specific action handlers
    }
  }

  private updateMediaSessionMetadata(track: TrackRecord, artworkUrl?: string): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.track_name,
        artist: track.artist,
        album: track.album,
        artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    } catch {
      // Non-fatal
    }
  }

  private cleanupObjectUrl(): void {
    if (this.currentRevoke) {
      this.currentRevoke();
      this.currentRevoke = null;
    }
  }

  public isUsingRealAudio(): boolean {
    return this.hasRealAudio;
  }

  public async loadTrack(track: TrackRecord, artworkUrl?: string): Promise<boolean> {
    if (this.activeTrackId === track.id && this.hasRealAudio) {
      return true;
    }

    this.audio.pause();
    this.cleanupObjectUrl();
    this.activeTrackId = track.id;
    this.hasRealAudio = false;
    this.updateMediaSessionMetadata(track, artworkUrl);

    try {
      // 1. Offline IndexedDB Pin Cache (instant, 100% offline)
      const pinned = await OfflinePinStore.getPinnedAudio(track.id);
      if (pinned) {
        const objUrl = URL.createObjectURL(pinned.blob);
        this.currentRevoke = () => URL.revokeObjectURL(objUrl);
        this.audio.src = objUrl;
        this.hasRealAudio = true;
        return true;
      }

      const url = track.media_url.trim();
      if (!url) return false;

      // 2. Local Helper stream or browser-selected File handle
      if (url.startsWith('/api/local/stream/') || url.startsWith('browser-file://')) {
        const res = await this.localProvider.getPlayableUrl(url);
        this.currentRevoke = res.revoke ?? null;
        this.audio.src = res.url;
        this.hasRealAudio = true;
        return true;
      }

      // 3. Google Drive file ID (real connected Drive file)
      if (url.startsWith('gdrive-file://')) {
        const fileId = url.replace('gdrive-file://', '');
        const res = await this.driveProvider.getPlayableUrl(fileId);
        this.currentRevoke = res.revoke ?? null;
        this.audio.src = res.url;
        this.hasRealAudio = true;
        return true;
      }

      // 4. Direct authorized HTTP/HTTPS audio URL (excluding placeholder .local demo URLs)
      if (
        (url.startsWith('http://') || url.startsWith('https://')) &&
        !url.includes('.personal-audio.local')
      ) {
        this.audio.src = url;
        this.hasRealAudio = true;
        return true;
      }

      return false;
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : 'Failed to load track audio.'
      );
      return false;
    }
  }

  public async play(): Promise<void> {
    if (!this.hasRealAudio) return;
    try {
      await this.audio.play();
    } catch {
      // Autoplay restriction or transient error
    }
  }

  public pause(): void {
    if (this.hasRealAudio) {
      this.audio.pause();
    }
  }

  public seek(seconds: number): void {
    if (this.hasRealAudio && Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, seconds);
    }
  }

  public isOutputSelectionSupported(): boolean {
    return typeof (this.audio as HTMLAudioElement & { setSinkId?: unknown }).setSinkId === 'function';
  }

  public getOutputDeviceId(): string {
    return (this.audio as HTMLAudioElement & { sinkId?: string }).sinkId ?? 'default';
  }

  public async setOutputDevice(deviceId: string): Promise<void> {
    const audioWithSink = this.audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof audioWithSink.setSinkId !== 'function') {
      throw new Error('Per-app speaker switching is managed by your device OS settings on this browser.');
    }
    await audioWithSink.setSinkId(deviceId);
  }

  public static async listOutputDevices(): Promise<AudioOutputDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || (d.deviceId === 'default' ? 'System Default Speaker' : `Speaker ${idx + 1}`),
      }));
  }

  public static async promptOutputDevice(): Promise<AudioOutputDevice | null> {
    const md = navigator.mediaDevices as MediaDevices & {
      selectAudioOutput?: () => Promise<MediaDeviceInfo>;
    };
    if (typeof md?.selectAudioOutput !== 'function') {
      return null;
    }
    const picked = await md.selectAudioOutput();
    return {
      deviceId: picked.deviceId,
      label: picked.label || 'Selected Speaker',
    };
  }

  public destroy(): void {
    this.audio.pause();
    this.audio.src = '';
    this.cleanupObjectUrl();
  }
}
