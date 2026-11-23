export type TrackStatus =
  | 'pending'
  | 'matched_local'
  | 'downloading'
  | 'downloaded'
  | 'skipped'
  | 'failed'
  | 'cloud_only';

export type StorageProvider = 'local_fs' | 'local_server' | 'indexeddb' | 'gdrive';

export interface TrackRecord {
  id: string;
  index: number;
  track_name: string;
  artist: string;
  album: string;
  duration: string;
  source_url: string;
  playlist_name: string;
  media_url: string;
  status: TrackStatus;
  storage_provider?: StorageProvider;
  isPinnedOffline?: boolean;
  error_message?: string;
}

export type NavView = 'library' | 'import' | 'queue' | 'cloud';

export type LibraryFilter = 'all' | 'local' | 'gdrive' | 'pinned';

export type SortField = 'index' | 'artist' | 'album' | 'date';

export type SortDirection = 'asc' | 'desc';

export type RepeatMode = 'off' | 'all' | 'one';

export interface TrackAuxMeta {
  addedDate: string; // ISO date string YYYY-MM-DD
  fileSizeMb: number;
  artworkUrl: string;
  sourceLabel: string;
}

export interface LocalFolderOption {
  id: string;
  label: string;
  path: string;
  provider: StorageProvider;
  availableGb: number;
}

export interface DriveFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  modifiedAt: string;
  itemCount: number;
}

export interface DriveFileItem {
  id: string;
  folderId: string;
  trackId?: string;
  fileName: string;
  trackName: string;
  artist: string;
  album: string;
  sizeMb: number;
  modifiedDate: string; // YYYY-MM-DD
  format: 'FLAC' | 'M4A' | 'MP3' | 'WAV' | 'CSV' | 'JSON';
  isPinnedOffline: boolean;
}

export interface ImportSummary {
  sourceName: string;
  addedCount: number;
  duplicateCount: number;
  totalParsed: number;
  timestamp: string;
}

export interface LibraryStats {
  totalSongs: number;
  deduplicatedCount: number;
  localReadyCount: number;
  cloudReadyCount: number;
  pinnedCount: number;
}

export interface SpotifyAccountState {
  connected: boolean;
  displayName: string;
  accountId: string;
  scope: string;
  lastSyncedAt?: string;
}

export interface GoogleDriveState {
  connected: boolean;
  accountEmail: string;
  rootFolderName: string;
  quotaUsedMb: number;
  quotaTotalMb: number;
  offlinePinQuotaMb: number;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistAnalyticsItem {
  playlistId: string;
  playlistName: string;
  totalSongs: number;
  localCount: number;
  cloudCount: number;
  pinnedCount: number;
  otherCount: number;
}

