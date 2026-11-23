import type { TrackRecord } from '../types';
import { normalizeMatchKey } from '../utils/filenameSanitizer';
import type { IStorageProvider, PlayableResource, StorageFile } from './StorageProvider';

export interface LocalHelperHealth {
  ok: boolean;
  activeFolder: string;
  folderExists: boolean;
  supportedExtensions: string[];
}

export interface LocalScannedFile {
  id: string;
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  ext: string;
  matchKey: string;
  streamUrl: string;
}

export interface LocalDownloadResponse {
  ok: boolean;
  fileId: string;
  fileName: string;
  localPath: string;
  streamUrl: string;
  sizeBytes: number;
}

export class LocalStorageProvider implements IStorageProvider {
  public readonly id = 'local_server' as const;
  public readonly label = 'Local Music Folder';

  private baseUrl: string;
  private cachedScan: LocalScannedFile[] = [];
  private browserFiles = new Map<string, File>();

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async checkHealth(): Promise<LocalHelperHealth | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) return null;
      return (await res.json()) as LocalHelperHealth;
    } catch {
      return null;
    }
  }

  public async isConnected(): Promise<boolean> {
    const health = await this.checkHealth();
    return Boolean(health?.ok) || this.browserFiles.size > 0;
  }

  public async connect(): Promise<void> {
    await this.scanFolder();
  }

  public async disconnect(): Promise<void> {
    this.cachedScan = [];
    this.browserFiles.clear();
  }

  public async setActiveFolder(folder: string, createIfMissing = true): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/local/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, createIfMissing }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to set local folder');
    }
    await this.scanFolder();
    return data.folder as string;
  }

  public registerBrowserFiles(files: FileList | File[]): StorageFile[] {
    const list = Array.from(files);
    const registered: StorageFile[] = [];
    for (const file of list) {
      const id = `browser-${normalizeMatchKey(file.name)}-${file.size}`;
      this.browserFiles.set(id, file);
      registered.push({
        id,
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        modifiedAt: new Date(file.lastModified).toISOString().slice(0, 10),
        provider: 'local_fs',
      });
    }
    return registered;
  }

  public async scanFolder(): Promise<LocalScannedFile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/local/scan`);
      if (!res.ok) return this.cachedScan;
      const data = (await res.json()) as { files: LocalScannedFile[] };
      this.cachedScan = data.files ?? [];
      return this.cachedScan;
    } catch {
      return this.cachedScan;
    }
  }

  public async listAudioFiles(): Promise<StorageFile[]> {
    const scanned = await this.scanFolder();
    const serverFiles: StorageFile[] = scanned.map((f) => ({
      id: f.id,
      name: f.fileName,
      mimeType: `audio/${f.ext.replace('.', '')}`,
      sizeBytes: f.sizeBytes,
      modifiedAt: f.modifiedAt,
      provider: 'local_server',
      streamUrl: `${this.baseUrl}${f.streamUrl}`,
    }));

    const localBrowserFiles: StorageFile[] = Array.from(this.browserFiles.entries()).map(
      ([id, file]) => ({
        id,
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        modifiedAt: new Date(file.lastModified).toISOString().slice(0, 10),
        provider: 'local_fs',
      })
    );

    return [...serverFiles, ...localBrowserFiles];
  }

  public async matchTrackInLocalFolder(
    track: Pick<TrackRecord, 'artist' | 'track_name'>
  ): Promise<{ matched: boolean; streamUrl?: string; provider?: 'local_server' | 'local_fs' }> {
    const artistKey = normalizeMatchKey(track.artist);
    const titleKey = normalizeMatchKey(track.track_name);
    if (!titleKey) return { matched: false };

    // 1. Check browser-registered files first
    for (const [id, file] of this.browserFiles.entries()) {
      const key = normalizeMatchKey(file.name);
      if (key.includes(titleKey) && (!artistKey || key.includes(artistKey))) {
        return {
          matched: true,
          streamUrl: `browser-file://${id}`,
          provider: 'local_fs',
        };
      }
    }

    // 2. Check local helper scanned files
    if (this.cachedScan.length === 0) {
      await this.scanFolder();
    }
    for (const file of this.cachedScan) {
      if (
        file.matchKey.includes(titleKey) &&
        (!artistKey || file.matchKey.includes(artistKey))
      ) {
        return {
          matched: true,
          streamUrl: `${this.baseUrl}${file.streamUrl}`,
          provider: 'local_server',
        };
      }
    }

    return { matched: false };
  }

  public async downloadAuthorizedToLocal(
    track: Pick<TrackRecord, 'index' | 'artist' | 'track_name' | 'media_url'>,
    signal?: AbortSignal
  ): Promise<LocalDownloadResponse> {
    const res = await fetch(`${this.baseUrl}/api/local/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        index: track.index,
        artist: track.artist,
        track_name: track.track_name,
        media_url: track.media_url,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Local helper download failed (HTTP ${res.status})`);
    }
    return data as LocalDownloadResponse;
  }

  public async getPlayableUrl(fileId: string): Promise<PlayableResource> {
    if (fileId.startsWith('browser-file://')) {
      const id = fileId.replace('browser-file://', '');
      const file = this.browserFiles.get(id);
      if (!file) throw new Error('Selected local browser file is no longer in memory.');
      const url = URL.createObjectURL(file);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    }

    if (fileId.startsWith('/api/local/stream/') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
      return { url: fileId };
    }

    return { url: `${this.baseUrl}/api/local/stream/${fileId}` };
  }

  public async downloadFile(fileId: string): Promise<Blob> {
    const resource = await this.getPlayableUrl(fileId);
    try {
      const res = await fetch(resource.url);
      if (!res.ok) throw new Error(`Failed to fetch local file (HTTP ${res.status})`);
      return await res.blob();
    } finally {
      resource.revoke?.();
    }
  }
}
