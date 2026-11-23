import type {
  DriveFileItem,
  LibraryFilter,
  LibraryStats,
  PlaylistAnalyticsItem,
  PlaylistRecord,
  SortDirection,
  SortField,
  TrackRecord,
} from '../types';

export const CSV_COLUMNS = [
  'index',
  'track_name',
  'artist',
  'album',
  'duration',
  'source_url',
  'playlist_name',
  'media_url',
  'status',
] as const;

export function parseDurationToSeconds(duration: string): number {
  const cleaned = duration.trim();
  if (!cleaned) return 0;
  const parts = cleaned.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] ?? 0;
}

export function formatSecondsToTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function isLocalReady(track: TrackRecord): boolean {
  return (
    track.status === 'downloaded' ||
    track.status === 'matched_local' ||
    track.storage_provider === 'local_fs' ||
    track.storage_provider === 'local_server' ||
    track.storage_provider === 'indexeddb'
  );
}

export function isCloudReady(track: TrackRecord): boolean {
  return track.storage_provider === 'gdrive' || track.status === 'cloud_only';
}

export function getTrackSourceLabel(track: TrackRecord): 'Pinned' | 'Local' | 'Drive' | 'Pending' {
  if (track.isPinnedOffline) return 'Pinned';
  if (track.storage_provider === 'gdrive' || track.status === 'cloud_only') return 'Drive';
  if (
    track.status === 'downloaded' ||
    track.status === 'matched_local' ||
    track.storage_provider === 'local_fs' ||
    track.storage_provider === 'local_server' ||
    track.storage_provider === 'indexeddb'
  ) {
    return 'Local';
  }
  return 'Pending';
}

export function computeLibraryStats(
  tracks: TrackRecord[],
  deduplicatedRemovedCount: number
): LibraryStats {
  let localReadyCount = 0;
  let cloudReadyCount = 0;
  let pinnedCount = 0;

  for (const track of tracks) {
    if (isLocalReady(track)) localReadyCount += 1;
    if (isCloudReady(track)) cloudReadyCount += 1;
    if (track.isPinnedOffline) pinnedCount += 1;
  }

  return {
    totalSongs: tracks.length,
    deduplicatedCount: deduplicatedRemovedCount,
    localReadyCount,
    cloudReadyCount,
    pinnedCount,
  };
}

export function computePlaylistAnalytics(
  tracks: TrackRecord[],
  playlists: PlaylistRecord[]
): PlaylistAnalyticsItem[] {
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const assignedTrackIds = new Set<string>();

  const summarize = (
    playlistId: string,
    playlistName: string,
    items: TrackRecord[]
  ): PlaylistAnalyticsItem => {
    let localCount = 0;
    let cloudCount = 0;
    let pinnedCount = 0;
    let otherCount = 0;

    for (const track of items) {
      const local = isLocalReady(track);
      const cloud = isCloudReady(track);
      if (local) localCount += 1;
      if (cloud) cloudCount += 1;
      if (!local && !cloud) otherCount += 1;
      if (track.isPinnedOffline) pinnedCount += 1;
    }

    return {
      playlistId,
      playlistName,
      totalSongs: items.length,
      localCount,
      cloudCount,
      pinnedCount,
      otherCount,
    };
  };

  const rows = playlists.map((pl) => {
    const resolved: TrackRecord[] = [];
    for (const id of pl.trackIds) {
      const found = trackById.get(id);
      if (found) {
        resolved.push(found);
        assignedTrackIds.add(id);
      }
    }
    return summarize(pl.id, pl.name, resolved);
  });

  const unassigned = tracks.filter((t) => !assignedTrackIds.has(t.id));
  if (unassigned.length > 0) {
    rows.push(summarize('__unassigned__', 'Unassigned', unassigned));
  }

  return rows;
}

export function makeTrackDedupeKey(track: Pick<TrackRecord, 'track_name' | 'artist'>): string {
  return `${track.track_name.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
}

export function deduplicateTracks(
  existing: TrackRecord[],
  incoming: TrackRecord[]
): { merged: TrackRecord[]; addedCount: number; duplicateCount: number } {
  const seen = new Set(existing.map((t) => makeTrackDedupeKey(t)));
  const merged = [...existing];
  let addedCount = 0;
  let duplicateCount = 0;

  for (const item of incoming) {
    const key = makeTrackDedupeKey(item);
    if (!item.track_name.trim() || seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    merged.push({
      ...item,
      index: merged.length + 1,
    });
    addedCount += 1;
  }

  return { merged, addedCount, duplicateCount };
}

export function createPlaylistRecord(
  playlists: PlaylistRecord[],
  rawName: string,
  initialTrackIds: string[] = []
): { playlists: PlaylistRecord[]; created?: PlaylistRecord; error?: string } {
  const name = rawName.trim();
  if (!name) {
    return { playlists, error: 'Playlist name cannot be empty.' };
  }
  const exists = playlists.some((p) => p.name.trim().toLowerCase() === name.toLowerCase());
  if (exists) {
    return { playlists, error: `A playlist named "${name}" already exists.` };
  }
  const today = new Date().toISOString().slice(0, 10);
  const uniqueIds = Array.from(new Set(initialTrackIds));
  const created: PlaylistRecord = {
    id: `pl-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    name,
    trackIds: uniqueIds,
    createdAt: today,
    updatedAt: today,
  };
  return {
    playlists: [...playlists, created],
    created,
  };
}

export function renamePlaylistRecord(
  playlists: PlaylistRecord[],
  tracks: TrackRecord[],
  playlistId: string,
  rawNewName: string
): { playlists: PlaylistRecord[]; tracks: TrackRecord[]; error?: string } {
  const target = playlists.find((p) => p.id === playlistId);
  if (!target) {
    return { playlists, tracks, error: 'Playlist not found.' };
  }
  const newName = rawNewName.trim();
  if (!newName) {
    return { playlists, tracks, error: 'Playlist name cannot be empty.' };
  }
  const conflict = playlists.some(
    (p) => p.id !== playlistId && p.name.trim().toLowerCase() === newName.toLowerCase()
  );
  if (conflict) {
    return { playlists, tracks, error: `A playlist named "${newName}" already exists.` };
  }
  const today = new Date().toISOString().slice(0, 10);
  const oldName = target.name;
  const nextPlaylists = playlists.map((p) =>
    p.id === playlistId ? { ...p, name: newName, updatedAt: today } : p
  );
  const nextTracks = tracks.map((t) =>
    t.playlist_name === oldName ? { ...t, playlist_name: newName } : t
  );
  return { playlists: nextPlaylists, tracks: nextTracks };
}

export function deletePlaylistRecord(
  playlists: PlaylistRecord[],
  tracks: TrackRecord[],
  playlistId: string
): { playlists: PlaylistRecord[]; tracks: TrackRecord[] } {
  const target = playlists.find((p) => p.id === playlistId);
  if (!target) return { playlists, tracks };

  const nextPlaylists = playlists.filter((p) => p.id !== playlistId);
  const nextTracks = tracks.map((track) => {
    if (track.playlist_name !== target.name) return track;
    const fallback = nextPlaylists.find((p) => p.trackIds.includes(track.id));
    return {
      ...track,
      playlist_name: fallback ? fallback.name : 'Unassigned',
    };
  });

  return { playlists: nextPlaylists, tracks: nextTracks };
}

export function addTrackToPlaylistRecord(
  playlists: PlaylistRecord[],
  tracks: TrackRecord[],
  playlistId: string,
  trackId: string
): { playlists: PlaylistRecord[]; tracks: TrackRecord[] } {
  const target = playlists.find((p) => p.id === playlistId);
  if (!target) return { playlists, tracks };

  const today = new Date().toISOString().slice(0, 10);
  const nextPlaylists = playlists.map((p) => {
    if (p.id !== playlistId) return p;
    if (p.trackIds.includes(trackId)) return p;
    return {
      ...p,
      trackIds: [...p.trackIds, trackId],
      updatedAt: today,
    };
  });

  const nextTracks = tracks.map((t) => {
    if (t.id !== trackId) return t;
    if (!t.playlist_name || t.playlist_name === 'Unassigned') {
      return { ...t, playlist_name: target.name };
    }
    return t;
  });

  return { playlists: nextPlaylists, tracks: nextTracks };
}

export function removeTrackFromPlaylistRecord(
  playlists: PlaylistRecord[],
  tracks: TrackRecord[],
  playlistId: string,
  trackId: string
): { playlists: PlaylistRecord[]; tracks: TrackRecord[] } {
  const target = playlists.find((p) => p.id === playlistId);
  if (!target) return { playlists, tracks };

  const today = new Date().toISOString().slice(0, 10);
  const nextPlaylists = playlists.map((p) =>
    p.id === playlistId
      ? {
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
          updatedAt: today,
        }
      : p
  );

  const nextTracks = tracks.map((t) => {
    if (t.id !== trackId || t.playlist_name !== target.name) return t;
    const other = nextPlaylists.find((p) => p.trackIds.includes(trackId));
    return {
      ...t,
      playlist_name: other ? other.name : 'Unassigned',
    };
  });

  return { playlists: nextPlaylists, tracks: nextTracks };
}

export function filterAndSortTracks(
  tracks: TrackRecord[],
  options: {
    query: string;
    filter: LibraryFilter;
    playlist: string;
    playlistTrackIds?: Set<string>;
    sortBy: SortField;
    sortDir: SortDirection;
    dateMap?: Record<string, string>;
  }
): TrackRecord[] {
  const q = options.query.trim().toLowerCase();

  const filtered = tracks.filter((track) => {
    if (options.filter === 'local' && !isLocalReady(track)) {
      return false;
    }
    if (options.filter === 'gdrive' && !isCloudReady(track)) {
      return false;
    }
    if (options.filter === 'pinned' && !track.isPinnedOffline) {
      return false;
    }
    if (options.playlist !== 'all') {
      if (options.playlistTrackIds) {
        if (!options.playlistTrackIds.has(track.id)) return false;
      } else if (track.playlist_name !== options.playlist) {
        return false;
      }
    }
    if (q) {
      const hay = `${track.track_name} ${track.artist} ${track.album} ${track.playlist_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = options.sortDir === 'asc' ? 1 : -1;
  const dateMap = options.dateMap ?? {};

  return [...filtered].sort((a, b) => {
    if (options.sortBy === 'artist') {
      const cmp = a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' });
      return cmp !== 0 ? cmp * dir : (a.index - b.index) * dir;
    }
    if (options.sortBy === 'album') {
      const cmp = a.album.localeCompare(b.album, undefined, { sensitivity: 'base' });
      return cmp !== 0 ? cmp * dir : (a.index - b.index) * dir;
    }
    if (options.sortBy === 'date') {
      const dateA = dateMap[a.id] ?? '2026-01-01';
      const dateB = dateMap[b.id] ?? '2026-01-01';
      const cmp = dateA.localeCompare(dateB);
      return cmp !== 0 ? cmp * dir : (a.index - b.index) * dir;
    }
    return (a.index - b.index) * dir;
  });
}

export function filterAndSortDriveFiles(
  files: DriveFileItem[],
  options: {
    query: string;
    sortBy: 'artist' | 'album' | 'date';
    sortDir: SortDirection;
  }
): DriveFileItem[] {
  const q = options.query.trim().toLowerCase();
  const filtered = q
    ? files.filter((f) =>
        `${f.trackName} ${f.artist} ${f.album} ${f.fileName}`.toLowerCase().includes(q)
      )
    : files;

  const dir = options.sortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    if (options.sortBy === 'artist') {
      return a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' }) * dir;
    }
    if (options.sortBy === 'album') {
      return a.album.localeCompare(b.album, undefined, { sensitivity: 'base' }) * dir;
    }
    return a.modifiedDate.localeCompare(b.modifiedDate) * dir;
  });
}

function escapeCsvField(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTracksToCsv(tracks: TrackRecord[], includeBom = false): string {
  const header = CSV_COLUMNS.join(',');
  const rows = tracks.map((t) =>
    [
      t.index,
      t.track_name,
      t.artist,
      t.album,
      t.duration,
      t.source_url,
      t.playlist_name,
      t.media_url,
      t.status,
    ]
      .map(escapeCsvField)
      .join(',')
  );
  const csvBody = [header, ...rows].join('\n');
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

function splitDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function makeImportedTrack(
  partial: Partial<TrackRecord> & { track_name: string; artist: string },
  seq: number
): TrackRecord {
  const slug = `${partial.track_name}-${partial.artist}-${seq}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id: `imp-${slug}-${seq}`,
    index: seq,
    track_name: partial.track_name,
    artist: partial.artist || 'Unknown Artist',
    album: partial.album || 'Single',
    duration: partial.duration || '3:30',
    source_url: partial.source_url || '',
    playlist_name: partial.playlist_name || 'Imported Library',
    media_url: partial.media_url || '',
    status: partial.status || 'pending',
    storage_provider: partial.storage_provider,
    isPinnedOffline: partial.isPinnedOffline ?? false,
  };
}

export function parseImportedFile(filename: string, content: string): TrackRecord[] {
  const lower = filename.toLowerCase();
  const trimmed = content.trim();
  if (!trimmed) return [];

  // 1. Spotify JSON export (YourLibrary.json or Playlist*.json)
  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const tracks: TrackRecord[] = [];

      // YourLibrary.json shape: { tracks: [{ artist, album, track, uri }] }
      if (parsed && Array.isArray(parsed.tracks)) {
        parsed.tracks.forEach((item: Record<string, string>, idx: number) => {
          if (!item.track && !item.track_name) return;
          tracks.push(
            makeImportedTrack(
              {
                track_name: item.track || item.track_name,
                artist: item.artist || 'Unknown Artist',
                album: item.album || 'Spotify Library',
                duration: item.duration || '3:42',
                source_url: item.uri
                  ? `https://open.spotify.com/track/${item.uri.split(':').pop()}`
                  : item.source_url || '',
                playlist_name: item.playlist_name || 'Spotify Export',
                media_url: item.media_url || '',
                status: 'pending',
              },
              idx + 1
            )
          );
        });
        return tracks;
      }

      // Playlist1.json shape: { playlists: [{ name, items: [{ track: { trackName, artistName, albumName, trackUri } }] }] }
      if (parsed && Array.isArray(parsed.playlists)) {
        let seq = 1;
        for (const pl of parsed.playlists) {
          const playlistName = pl.name || 'Spotify Playlist';
          const items = Array.isArray(pl.items) ? pl.items : [];
          for (const entry of items) {
            const t = entry.track ?? entry;
            if (!t?.trackName && !t?.track_name) continue;
            tracks.push(
              makeImportedTrack(
                {
                  track_name: t.trackName || t.track_name,
                  artist: t.artistName || t.artist || 'Unknown Artist',
                  album: t.albumName || t.album || 'Single',
                  duration: t.duration || '3:54',
                  source_url: t.trackUri
                    ? `https://open.spotify.com/track/${String(t.trackUri).split(':').pop()}`
                    : '',
                  playlist_name: playlistName,
                  media_url: '',
                  status: 'pending',
                },
                seq++
              )
            );
          }
        }
        return tracks;
      }

      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, string>, idx: number) => {
          if (!item.track_name && !item.trackName && !item.title) return;
          tracks.push(
            makeImportedTrack(
              {
                track_name: item.track_name || item.trackName || item.title,
                artist: item.artist || item.artistName || 'Unknown Artist',
                album: item.album || item.albumName || 'Imported',
                duration: item.duration || '3:40',
                source_url: item.source_url || '',
                playlist_name: item.playlist_name || 'Imported JSON',
                media_url: item.media_url || '',
                status: 'pending',
              },
              idx + 1
            )
          );
        });
        return tracks;
      }
    } catch {
      return [];
    }
  }

  // 2. Apple Music Library.xml (plist XML)
  if (lower.endsWith('.xml') || trimmed.startsWith('<?xml') || trimmed.includes('<plist')) {
    const tracks: TrackRecord[] = [];
    const dictRegex = /<dict>([\s\S]*?)<\/dict>/g;
    let match: RegExpExecArray | null;
    let seq = 1;

    while ((match = dictRegex.exec(trimmed)) !== null) {
      const block = match[1];
      if (!block.includes('<key>Name</key>') || !block.includes('<key>Artist</key>')) {
        continue;
      }
      const decodeXmlEntities = (val: string): string =>
        val
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'");

      const getVal = (key: string): string => {
        const re = new RegExp(
          `<key>${key}</key>\\s*<(?:string|integer)>([^<]*)</(?:string|integer)>`
        );
        const found = re.exec(block);
        return found ? decodeXmlEntities(found[1].trim()) : '';
      };

      const name = getVal('Name');
      const artist = getVal('Artist');
      if (!name) continue;
      const album = getVal('Album') || 'Apple Music Export';
      const totalTimeMs = Number.parseInt(getVal('Total Time'), 10);
      const duration =
        !Number.isNaN(totalTimeMs) && totalTimeMs > 0
          ? formatSecondsToTime(Math.round(totalTimeMs / 1000))
          : '3:45';
      const location = getVal('Location');

      tracks.push(
        makeImportedTrack(
          {
            track_name: name,
            artist,
            album,
            duration,
            source_url: 'apple-music://library-xml',
            playlist_name: 'Apple Music Library',
            media_url: location,
            status: location.startsWith('file://') ? 'matched_local' : 'pending',
            storage_provider: location.startsWith('file://') ? 'local_fs' : undefined,
          },
          seq++
        )
      );
    }
    return tracks;
  }

  // 3. CSV or Apple Music TSV (.csv / .txt)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter: ',' | '\t' = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '')
  );

  const findCol = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.includes(h));

  const nameIdx = findCol(['track_name', 'trackname', 'name', 'title', 'song']);
  const artistIdx = findCol(['artist', 'artistname', 'artists', 'artistnames']);
  const albumIdx = findCol(['album', 'albumname']);
  const durationIdx = findCol(['duration', 'time', 'length']);
  const sourceIdx = findCol(['source_url', 'sourceurl', 'url', 'uri']);
  const playlistIdx = findCol(['playlist_name', 'playlistname', 'playlist']);
  const mediaIdx = findCol(['media_url', 'mediaurl', 'file', 'location']);

  if (nameIdx === -1) return [];

  const tracks: TrackRecord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitDelimitedLine(lines[i], delimiter);
    const trackName = cols[nameIdx] ?? '';
    if (!trackName) continue;

    tracks.push(
      makeImportedTrack(
        {
          track_name: trackName,
          artist: artistIdx >= 0 ? cols[artistIdx] || 'Unknown Artist' : 'Unknown Artist',
          album: albumIdx >= 0 ? cols[albumIdx] || 'Imported Album' : 'Imported Album',
          duration: durationIdx >= 0 && cols[durationIdx] ? cols[durationIdx] : '3:35',
          source_url: sourceIdx >= 0 ? cols[sourceIdx] || '' : '',
          playlist_name:
            playlistIdx >= 0 && cols[playlistIdx] ? cols[playlistIdx] : 'CSV Import',
          media_url: mediaIdx >= 0 ? cols[mediaIdx] || '' : '',
          status: 'pending',
        },
        tracks.length + 1
      )
    );
  }

  return tracks;
}
