import type {
  DriveFileItem,
  DriveFolder,
  GoogleDriveState,
  LocalFolderOption,
  PlaylistRecord,
  SpotifyAccountState,
  TrackAuxMeta,
  TrackRecord,
} from '../types';
import {
  addTrackToPlaylistRecord,
  createPlaylistRecord,
  deletePlaylistRecord,
  removeTrackFromPlaylistRecord,
  renamePlaylistRecord,
} from '../utils/libraryUtils';

export const ARTWORK = {
  midnight: '/src/assets/images/album_analog_midnight_1795425232138.jpg',
  monolith: '/src/assets/images/album_focus_monolith_1795425229023.jpg',
  transit: '/src/assets/images/album_morning_transit_1795425228993.jpg',
  timber: '/src/assets/images/album_acoustic_timber_1795425230602.jpg',
} as const;

export const INITIAL_TRACKS: TrackRecord[] = [
  {
    id: 'trk-01',
    index: 1,
    track_name: 'Rain on Mercer Street',
    artist: 'Kora Vance',
    album: 'Analog Midnight',
    duration: '4:12',
    source_url: 'https://open.spotify.com/track/4cMercer01',
    playlist_name: 'Late Night Analog',
    media_url: 'file:///Music/Crate Library/Kora Vance - Rain on Mercer Street.flac',
    status: 'downloaded',
    storage_provider: 'local_fs',
    isPinnedOffline: true,
  },
  {
    id: 'trk-02',
    index: 2,
    track_name: 'Concrete Light, Pt. II',
    artist: 'Anselm Trio',
    album: 'Monolith Studies',
    duration: '5:08',
    source_url: 'https://open.spotify.com/track/7dMonolith02',
    playlist_name: 'Deep Focus Sessions',
    media_url: 'file:///Music/Crate Library/Anselm Trio - Concrete Light Pt II.flac',
    status: 'matched_local',
    storage_provider: 'local_fs',
    isPinnedOffline: true,
  },
  {
    id: 'trk-03',
    index: 3,
    track_name: 'Pine Road at 5:40 AM',
    artist: 'Nordic Drift',
    album: 'Blue Hour Transit',
    duration: '3:44',
    source_url: 'https://open.spotify.com/track/9aTransit03',
    playlist_name: 'Morning Commute',
    media_url: 'gdrive://Crate Music Vault/Lossless Masters/Nordic Drift - Pine Road.flac',
    status: 'cloud_only',
    storage_provider: 'gdrive',
    isPinnedOffline: false,
  },
  {
    id: 'trk-04',
    index: 4,
    track_name: 'Cedar Harbor Acoustic',
    artist: 'Maren Sol',
    album: 'Wood & Wire',
    duration: '3:27',
    source_url: 'https://music.apple.com/us/album/wood-and-wire/04',
    playlist_name: 'Acoustic Archive',
    media_url: 'https://archive.personal-audio.local/authorized/cedar-harbor.m4a',
    status: 'failed',
    error_message: 'HTTP 408 request timeout from authorized media URL — retry available',
    isPinnedOffline: false,
  },
  {
    id: 'trk-05',
    index: 5,
    track_name: 'Sodium Vapor',
    artist: 'Kora Vance',
    album: 'Analog Midnight',
    duration: '3:56',
    source_url: 'https://open.spotify.com/track/4cMercer05',
    playlist_name: 'Late Night Analog',
    media_url: 'https://archive.personal-audio.local/authorized/sodium-vapor.flac',
    status: 'pending',
    isPinnedOffline: false,
  },
  {
    id: 'trk-06',
    index: 6,
    track_name: 'Zenith Courtyard',
    artist: 'Anselm Trio',
    album: 'Monolith Studies',
    duration: '4:41',
    source_url: 'https://open.spotify.com/track/7dMonolith06',
    playlist_name: 'Deep Focus Sessions',
    media_url: 'gdrive://Crate Music Vault/Lossless Masters/Anselm Trio - Zenith Courtyard.flac',
    status: 'cloud_only',
    storage_provider: 'gdrive',
    isPinnedOffline: true,
  },
  {
    id: 'trk-07',
    index: 7,
    track_name: 'Ferry Across Sound',
    artist: 'Nordic Drift',
    album: 'Blue Hour Transit',
    duration: '4:19',
    source_url: 'https://open.spotify.com/track/9aTransit07',
    playlist_name: 'Morning Commute',
    media_url: 'https://archive.personal-audio.local/authorized/ferry-across-sound.m4a',
    status: 'pending',
    isPinnedOffline: false,
  },
  {
    id: 'trk-08',
    index: 8,
    track_name: 'Warm Spruce Resonance',
    artist: 'Maren Sol',
    album: 'Wood & Wire',
    duration: '2:58',
    source_url: 'https://music.apple.com/us/album/wood-and-wire/08',
    playlist_name: 'Acoustic Archive',
    media_url: 'file:///Music/Crate Library/Maren Sol - Warm Spruce Resonance.m4a',
    status: 'downloaded',
    storage_provider: 'local_fs',
    isPinnedOffline: false,
  },
  {
    id: 'trk-09',
    index: 9,
    track_name: 'Tape Loop No. 4',
    artist: 'Sora Takahashi',
    album: 'Analog Midnight',
    duration: '5:22',
    source_url: 'https://open.spotify.com/track/5eTape09',
    playlist_name: 'Late Night Analog',
    media_url: 'gdrive://Crate Music Vault/Offloaded Tracks/Sora Takahashi - Tape Loop 4.flac',
    status: 'cloud_only',
    storage_provider: 'gdrive',
    isPinnedOffline: false,
  },
  {
    id: 'trk-10',
    index: 10,
    track_name: 'Drafting Table',
    artist: 'Clara Lindqvist',
    album: 'Monolith Studies',
    duration: '3:51',
    source_url: 'https://open.spotify.com/track/8bDraft10',
    playlist_name: 'Deep Focus Sessions',
    media_url: 'https://archive.personal-audio.local/authorized/drafting-table.flac',
    status: 'pending',
    isPinnedOffline: false,
  },
  {
    id: 'trk-11',
    index: 11,
    track_name: 'Coastline Fog',
    artist: 'Nordic Drift',
    album: 'Blue Hour Transit',
    duration: '4:03',
    source_url: 'https://music.apple.com/us/album/blue-hour/11',
    playlist_name: 'Morning Commute',
    media_url: 'file:///Music/Crate Library/Nordic Drift - Coastline Fog.m4a',
    status: 'matched_local',
    storage_provider: 'local_fs',
    isPinnedOffline: true,
  },
  {
    id: 'trk-12',
    index: 12,
    track_name: 'Brass String Etude (Demo)',
    artist: 'Maren Sol',
    album: 'Wood & Wire',
    duration: '2:14',
    source_url: 'https://music.apple.com/us/album/wood-and-wire/12',
    playlist_name: 'Acoustic Archive',
    media_url: '',
    status: 'skipped',
    error_message: 'Skipped: no user-supplied direct media URL attached',
    isPinnedOffline: false,
  },
];

export const INITIAL_TRACK_META: Record<string, TrackAuxMeta> = {
  'trk-01': {
    addedDate: '2026-11-18',
    fileSizeMb: 34.2,
    artworkUrl: ARTWORK.midnight,
    sourceLabel: 'Official Spotify Export',
  },
  'trk-02': {
    addedDate: '2026-11-15',
    fileSizeMb: 41.8,
    artworkUrl: ARTWORK.monolith,
    sourceLabel: 'User-Owned Local File',
  },
  'trk-03': {
    addedDate: '2026-11-12',
    fileSizeMb: 29.4,
    artworkUrl: ARTWORK.transit,
    sourceLabel: 'Google Drive Vault',
  },
  'trk-04': {
    addedDate: '2026-11-10',
    fileSizeMb: 11.6,
    artworkUrl: ARTWORK.timber,
    sourceLabel: 'Authorized Direct URL',
  },
  'trk-05': {
    addedDate: '2026-11-19',
    fileSizeMb: 32.0,
    artworkUrl: ARTWORK.midnight,
    sourceLabel: 'Authorized Direct URL',
  },
  'trk-06': {
    addedDate: '2026-11-08',
    fileSizeMb: 38.5,
    artworkUrl: ARTWORK.monolith,
    sourceLabel: 'Google Drive Vault',
  },
  'trk-07': {
    addedDate: '2026-11-20',
    fileSizeMb: 14.1,
    artworkUrl: ARTWORK.transit,
    sourceLabel: 'Authorized Direct URL',
  },
  'trk-08': {
    addedDate: '2026-11-04',
    fileSizeMb: 9.8,
    artworkUrl: ARTWORK.timber,
    sourceLabel: 'User-Owned Local File',
  },
  'trk-09': {
    addedDate: '2026-10-29',
    fileSizeMb: 44.6,
    artworkUrl: ARTWORK.midnight,
    sourceLabel: 'Google Drive Vault',
  },
  'trk-10': {
    addedDate: '2026-11-21',
    fileSizeMb: 31.4,
    artworkUrl: ARTWORK.monolith,
    sourceLabel: 'Authorized Direct URL',
  },
  'trk-11': {
    addedDate: '2026-11-02',
    fileSizeMb: 13.7,
    artworkUrl: ARTWORK.transit,
    sourceLabel: 'User-Owned Local File',
  },
  'trk-12': {
    addedDate: '2026-10-24',
    fileSizeMb: 0,
    artworkUrl: ARTWORK.timber,
    sourceLabel: 'Apple Music Library.xml',
  },
};

export const LOCAL_FOLDER_OPTIONS: LocalFolderOption[] = [
  {
    id: 'folder-local-fs',
    label: 'Primary Local Music Folder',
    path: '/Users/alex/Music/Crate Library',
    provider: 'local_fs',
    availableGb: 184.6,
  },
  {
    id: 'folder-ssd',
    label: 'External Audio SSD',
    path: '/Volumes/AudioSSD/Personal Masters',
    provider: 'local_fs',
    availableGb: 712.0,
  },
  {
    id: 'folder-idb',
    label: 'Browser Offline Cache (IndexedDB)',
    path: 'indexeddb://crate-offline-cache/tracks',
    provider: 'indexeddb',
    availableGb: 4.8,
  },
];

export const INITIAL_DRIVE_FOLDERS: DriveFolder[] = [
  {
    id: 'drv-root',
    name: 'Crate Music Vault',
    parentId: null,
    path: 'My Drive / Crate Music Vault',
    modifiedAt: '2026-11-20',
    itemCount: 3,
  },
  {
    id: 'drv-lossless',
    name: 'Lossless Masters',
    parentId: 'drv-root',
    path: 'My Drive / Crate Music Vault / Lossless Masters',
    modifiedAt: '2026-11-18',
    itemCount: 4,
  },
  {
    id: 'drv-offloaded',
    name: 'Offloaded Tracks',
    parentId: 'drv-root',
    path: 'My Drive / Crate Music Vault / Offloaded Tracks',
    modifiedAt: '2026-11-14',
    itemCount: 2,
  },
  {
    id: 'drv-exports',
    name: 'CSV & Playlist Backups',
    parentId: 'drv-root',
    path: 'My Drive / Crate Music Vault / CSV & Playlist Backups',
    modifiedAt: '2026-11-21',
    itemCount: 2,
  },
];

export const INITIAL_DRIVE_FILES: DriveFileItem[] = [
  {
    id: 'df-1',
    folderId: 'drv-lossless',
    trackId: 'trk-03',
    fileName: 'Nordic Drift - Pine Road at 540 AM.flac',
    trackName: 'Pine Road at 5:40 AM',
    artist: 'Nordic Drift',
    album: 'Blue Hour Transit',
    sizeMb: 29.4,
    modifiedDate: '2026-11-12',
    format: 'FLAC',
    isPinnedOffline: false,
  },
  {
    id: 'df-2',
    folderId: 'drv-lossless',
    trackId: 'trk-06',
    fileName: 'Anselm Trio - Zenith Courtyard.flac',
    trackName: 'Zenith Courtyard',
    artist: 'Anselm Trio',
    album: 'Monolith Studies',
    sizeMb: 38.5,
    modifiedDate: '2026-11-08',
    format: 'FLAC',
    isPinnedOffline: true,
  },
  {
    id: 'df-3',
    folderId: 'drv-lossless',
    trackId: 'trk-01',
    fileName: 'Kora Vance - Rain on Mercer Street.flac',
    trackName: 'Rain on Mercer Street',
    artist: 'Kora Vance',
    album: 'Analog Midnight',
    sizeMb: 34.2,
    modifiedDate: '2026-11-18',
    format: 'FLAC',
    isPinnedOffline: true,
  },
  {
    id: 'df-4',
    folderId: 'drv-lossless',
    fileName: 'Clara Lindqvist - Quiet Atrium (24-bit).flac',
    trackName: 'Quiet Atrium (24-bit)',
    artist: 'Clara Lindqvist',
    album: 'Monolith Studies',
    sizeMb: 46.1,
    modifiedDate: '2026-11-05',
    format: 'FLAC',
    isPinnedOffline: false,
  },
  {
    id: 'df-5',
    folderId: 'drv-offloaded',
    trackId: 'trk-09',
    fileName: 'Sora Takahashi - Tape Loop No 4.flac',
    trackName: 'Tape Loop No. 4',
    artist: 'Sora Takahashi',
    album: 'Analog Midnight',
    sizeMb: 44.6,
    modifiedDate: '2026-10-29',
    format: 'FLAC',
    isPinnedOffline: false,
  },
  {
    id: 'df-6',
    folderId: 'drv-offloaded',
    fileName: 'Maren Sol - Porchlight Session.m4a',
    trackName: 'Porchlight Session',
    artist: 'Maren Sol',
    album: 'Wood & Wire',
    sizeMb: 12.4,
    modifiedDate: '2026-10-19',
    format: 'M4A',
    isPinnedOffline: false,
  },
  {
    id: 'df-7',
    folderId: 'drv-exports',
    fileName: 'Crate_Library_2026-11-21_UTF8.csv',
    trackName: 'Library Snapshot (Nov 21)',
    artist: 'Crate Backup',
    album: 'Metadata Archive',
    sizeMb: 0.4,
    modifiedDate: '2026-11-21',
    format: 'CSV',
    isPinnedOffline: false,
  },
  {
    id: 'df-8',
    folderId: 'drv-exports',
    fileName: 'Spotify_Playlist1_Verified.json',
    trackName: 'Spotify Export Archive',
    artist: 'Official Export',
    album: 'Metadata Archive',
    sizeMb: 1.2,
    modifiedDate: '2026-11-16',
    format: 'JSON',
    isPinnedOffline: false,
  },
];

export const INITIAL_SPOTIFY_STATE: SpotifyAccountState = {
  connected: false,
  displayName: 'Alex Mercer',
  accountId: 'alex.personal.lib',
  scope: 'user-library-read playlist-read-private',
};

export const INITIAL_DRIVE_STATE: GoogleDriveState = {
  connected: true,
  accountEmail: 'alex.library@gmail.com',
  rootFolderName: 'Crate Music Vault',
  quotaUsedMb: 206.8,
  quotaTotalMb: 15360, // 15 GB
  offlinePinQuotaMb: 1024, // 1 GB local pin cache budget
};

export function getArtworkForTrack(track: TrackRecord, metaMap: Record<string, TrackAuxMeta>): string {
  if (metaMap[track.id]?.artworkUrl) {
    return metaMap[track.id].artworkUrl;
  }
  const lower = `${track.album} ${track.playlist_name}`.toLowerCase();
  if (lower.includes('focus') || lower.includes('monolith') || lower.includes('concrete')) {
    return ARTWORK.monolith;
  }
  if (lower.includes('morning') || lower.includes('commute') || lower.includes('transit')) {
    return ARTWORK.transit;
  }
  if (lower.includes('acoustic') || lower.includes('wood') || lower.includes('cedar')) {
    return ARTWORK.timber;
  }
  return ARTWORK.midnight;
}

export function getSampleExportPayload(preset: 'spotify' | 'apple' | 'csv'): {
  filename: string;
  content: string;
} {
  if (preset === 'spotify') {
    return {
      filename: 'Playlist1.json',
      content: JSON.stringify(
        {
          playlists: [
            {
              name: 'Late Night Analog',
              items: [
                {
                  track: {
                    trackName: 'Rain on Mercer Street',
                    artistName: 'Kora Vance',
                    albumName: 'Analog Midnight',
                    trackUri: 'spotify:track:4cMercer01',
                  },
                },
                {
                  track: {
                    trackName: 'Velvet Subway',
                    artistName: 'Sora Takahashi',
                    albumName: 'Analog Midnight',
                    trackUri: 'spotify:track:9kSubway14',
                    duration: '4:06',
                  },
                },
                {
                  track: {
                    trackName: 'Last Tram Home',
                    artistName: 'Kora Vance',
                    albumName: 'Analog Midnight',
                    trackUri: 'spotify:track:3mTram15',
                    duration: '3:48',
                  },
                },
              ],
            },
          ],
        },
        null,
        2
      ),
    };
  }

  if (preset === 'apple') {
    return {
      filename: 'Library.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Tracks</key>
  <dict>
    <key>201</key>
    <dict>
      <key>Name</key><string>Cedar Harbor Acoustic</string>
      <key>Artist</key><string>Maren Sol</string>
      <key>Album</key><string>Wood &amp; Wire</string>
      <key>Total Time</key><integer>207000</integer>
    </dict>
    <key>202</key>
    <dict>
      <key>Name</key><string>Quiet Mill Stream</string>
      <key>Artist</key><string>Maren Sol</string>
      <key>Album</key><string>Wood &amp; Wire</string>
      <key>Total Time</key><integer>198000</integer>
      <key>Location</key><string>file:///Users/alex/Music/Quiet%20Mill%20Stream.m4a</string>
    </dict>
  </dict>
</dict>
</plist>`,
    };
  }

  return {
    filename: 'personal-authorized-tracks.csv',
    content: [
      'index,track_name,artist,album,duration,source_url,playlist_name,media_url,status',
      '1,Harbor Mist,Nordic Drift,Blue Hour Transit,3:52,https://archive.personal-audio.local/catalog/1,Morning Commute,https://archive.personal-audio.local/authorized/harbor-mist.flac,pending',
      '2,Quiet Concrete,Clara Lindqvist,Monolith Studies,4:28,https://archive.personal-audio.local/catalog/2,Deep Focus Sessions,https://archive.personal-audio.local/authorized/quiet-concrete.flac,pending',
    ].join('\n'),
  };
}

export async function mockConnectSpotifyPkce(): Promise<{
  account: SpotifyAccountState;
  importedTracks: TrackRecord[];
}> {
  await new Promise((resolve) => setTimeout(resolve, 420));
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    account: {
      connected: true,
      displayName: 'Alex Mercer',
      accountId: 'alex.personal.lib',
      scope: 'user-library-read playlist-read-private',
      lastSyncedAt: `Today, ${now}`,
    },
    importedTracks: [
      {
        id: `sp-pkce-${Date.now()}-1`,
        index: 0,
        track_name: 'Rain on Mercer Street', // intentional duplicate to demonstrate deduplication
        artist: 'Kora Vance',
        album: 'Analog Midnight',
        duration: '4:12',
        source_url: 'https://open.spotify.com/track/4cMercer01',
        playlist_name: 'Late Night Analog',
        media_url: '',
        status: 'pending',
      },
      {
        id: `sp-pkce-${Date.now()}-2`,
        index: 0,
        track_name: 'Glass Stairwell',
        artist: 'Clara Lindqvist',
        album: 'Monolith Studies',
        duration: '4:35',
        source_url: 'https://open.spotify.com/track/8cGlass21',
        playlist_name: 'Deep Focus Sessions',
        media_url: 'https://archive.personal-audio.local/authorized/glass-stairwell.flac',
        status: 'pending',
      },
      {
        id: `sp-pkce-${Date.now()}-3`,
        index: 0,
        track_name: 'Early Platform',
        artist: 'Nordic Drift',
        album: 'Blue Hour Transit',
        duration: '3:39',
        source_url: 'https://open.spotify.com/track/6pPlat22',
        playlist_name: 'Morning Commute',
        media_url: 'https://archive.personal-audio.local/authorized/early-platform.m4a',
        status: 'pending',
      },
    ],
  };
}

export async function mockConnectGoogleDrive(currentlyConnected: boolean): Promise<GoogleDriveState> {
  await new Promise((resolve) => setTimeout(resolve, 320));
  return {
    ...INITIAL_DRIVE_STATE,
    connected: !currentlyConnected,
  };
}

export function mockSimulateSingleTrackTransfer(
  track: TrackRecord,
  folder: LocalFolderOption,
  onProgress: (percent: number) => void,
  onComplete: (result: {
    status: 'downloaded' | 'failed';
    media_url?: string;
    storage_provider?: LocalFolderOption['provider'];
    error_message?: string;
  }) => void
): () => void {
  let progress = 0;
  let cancelled = false;

  const timer = window.setInterval(() => {
    if (cancelled) return;
    // Smooth deterministic step ~14-22% per 160ms tick (~0.9s total per track so users can clearly observe 1-by-1 progress)
    progress = Math.min(100, progress + 18);
    onProgress(progress);

    if (progress >= 100) {
      window.clearInterval(timer);
      const safeName = `${track.artist} - ${track.track_name}`.replace(/[^a-zA-Z0-9 -]/g, '');
      onComplete({
        status: 'downloaded',
        media_url: `file://${folder.path}/${safeName}.flac`,
        storage_provider: folder.provider,
      });
    }
  }, 160);

  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}

export const INITIAL_PLAYLISTS: PlaylistRecord[] = [
  {
    id: 'pl-late-night-analog',
    name: 'Late Night Analog',
    trackIds: ['trk-01', 'trk-05', 'trk-09'],
    createdAt: '2026-10-15',
    updatedAt: '2026-11-19',
  },
  {
    id: 'pl-deep-focus-sessions',
    name: 'Deep Focus Sessions',
    trackIds: ['trk-02', 'trk-06', 'trk-10'],
    createdAt: '2026-10-18',
    updatedAt: '2026-11-21',
  },
  {
    id: 'pl-morning-commute',
    name: 'Morning Commute',
    trackIds: ['trk-03', 'trk-07', 'trk-11'],
    createdAt: '2026-10-22',
    updatedAt: '2026-11-20',
  },
  {
    id: 'pl-acoustic-archive',
    name: 'Acoustic Archive',
    trackIds: ['trk-04', 'trk-08', 'trk-12'],
    createdAt: '2026-10-25',
    updatedAt: '2026-11-10',
  },
];

export function syncImportedTracksIntoPlaylists(
  playlists: PlaylistRecord[],
  addedTracks: TrackRecord[]
): PlaylistRecord[] {
  let next = [...playlists];
  const today = new Date().toISOString().slice(0, 10);

  for (const track of addedTracks) {
    const plName = track.playlist_name.trim();
    if (!plName || plName === 'Unassigned') continue;
    const idx = next.findIndex((p) => p.name.trim().toLowerCase() === plName.toLowerCase());
    if (idx >= 0) {
      if (!next[idx].trackIds.includes(track.id)) {
        next[idx] = {
          ...next[idx],
          trackIds: [...next[idx].trackIds, track.id],
          updatedAt: today,
        };
      }
    } else {
      const createdRes = createPlaylistRecord(next, plName, [track.id]);
      next = createdRes.playlists;
    }
  }
  return next;
}

export const mockPlaylistService = {
  create(playlists: PlaylistRecord[], name: string, initialTrackIds: string[] = []) {
    return createPlaylistRecord(playlists, name, initialTrackIds);
  },
  rename(
    playlists: PlaylistRecord[],
    tracks: TrackRecord[],
    playlistId: string,
    newName: string
  ) {
    return renamePlaylistRecord(playlists, tracks, playlistId, newName);
  },
  remove(playlists: PlaylistRecord[], tracks: TrackRecord[], playlistId: string) {
    return deletePlaylistRecord(playlists, tracks, playlistId);
  },
  addTrack(
    playlists: PlaylistRecord[],
    tracks: TrackRecord[],
    playlistId: string,
    trackId: string
  ) {
    return addTrackToPlaylistRecord(playlists, tracks, playlistId, trackId);
  },
  removeTrack(
    playlists: PlaylistRecord[],
    tracks: TrackRecord[],
    playlistId: string,
    trackId: string
  ) {
    return removeTrackFromPlaylistRecord(playlists, tracks, playlistId, trackId);
  },
  saveQueueAsPlaylist(
    playlists: PlaylistRecord[],
    tracks: TrackRecord[],
    name: string,
    queueTrackIds: string[]
  ) {
    const res = createPlaylistRecord(playlists, name, queueTrackIds);
    if (res.error || !res.created) {
      return { playlists, tracks, error: res.error };
    }
    const createdName = res.created.name;
    const idSet = new Set(res.created.trackIds);
    const nextTracks = tracks.map((t) =>
      idSet.has(t.id) && (!t.playlist_name || t.playlist_name === 'Unassigned')
        ? { ...t, playlist_name: createdName }
        : t
    );
    return { playlists: res.playlists, tracks: nextTracks, created: res.created };
  },
};

