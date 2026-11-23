import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { TrackRecord } from '../types';
import {
  CSV_COLUMNS,
  computeLibraryStats,
  deduplicateTracks,
  exportTracksToCsv,
  filterAndSortDriveFiles,
  filterAndSortTracks,
  formatSecondsToTime,
  parseDurationToSeconds,
  parseImportedFile,
} from './libraryUtils';

const sampleTracks: TrackRecord[] = [
  {
    id: 't1',
    index: 1,
    track_name: 'Rain on Mercer',
    artist: 'Kora Vance',
    album: 'Midnight Tape',
    duration: '4:12',
    source_url: 'https://open.spotify.com/track/mercer01',
    playlist_name: 'Late Night Analog',
    media_url: 'file:///Music/Crate/rain-on-mercer.flac',
    status: 'downloaded',
    storage_provider: 'local_fs',
    isPinnedOffline: true,
  },
  {
    id: 't2',
    index: 2,
    track_name: 'Concrete Light, Pt. II',
    artist: 'Anselm Trio',
    album: 'Brutalist Studies',
    duration: '5:08',
    source_url: 'https://open.spotify.com/track/concrete02',
    playlist_name: 'Deep Focus Sessions',
    media_url: 'gdrive://vault/concrete-light.flac',
    status: 'cloud_only',
    storage_provider: 'gdrive',
    isPinnedOffline: false,
  },
  {
    id: 't3',
    index: 3,
    track_name: 'Cedar Harbor',
    artist: 'Maren Sol',
    album: 'Wood & Wire',
    duration: '3:27',
    source_url: 'https://music.apple.com/track/cedar03',
    playlist_name: 'Acoustic Archive',
    media_url: 'https://media.example.org/authorized/cedar-harbor.m4a',
    status: 'failed',
    error_message: 'HTTP 408 timeout',
  },
];

test('parseDurationToSeconds and formatSecondsToTime round-trip accurately', () => {
  assert.equal(parseDurationToSeconds('4:12'), 252);
  assert.equal(parseDurationToSeconds('0:05'), 5);
  assert.equal(formatSecondsToTime(252), '4:12');
  assert.equal(formatSecondsToTime(65), '1:05');
});

test('exportTracksToCsv outputs exact required column header and escapes commas', () => {
  const csv = exportTracksToCsv(sampleTracks);
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    'index,track_name,artist,album,duration,source_url,playlist_name,media_url,status'
  );
  assert.equal(CSV_COLUMNS.length, 9);
  assert.equal(lines.length, 4);
  assert.ok(lines[2].includes('"Concrete Light, Pt. II"'));
  assert.ok(lines[3].endsWith(',failed'));
});

test('deduplicateTracks merges unique tracks and skips case-insensitive duplicates', () => {
  const incoming: TrackRecord[] = [
    { ...sampleTracks[0], id: 'dup1', track_name: 'rain on mercer', artist: 'kora vance' },
    {
      id: 'new1',
      index: 1,
      track_name: 'Pine Road',
      artist: 'Nordic Drift',
      album: 'Blue Hour',
      duration: '3:44',
      source_url: '',
      playlist_name: 'Morning Commute',
      media_url: '',
      status: 'pending',
    },
  ];
  const res = deduplicateTracks(sampleTracks, incoming);
  assert.equal(res.addedCount, 1);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.merged.length, 4);
  assert.equal(res.merged[3].index, 4);
});

test('parseImportedFile parses Spotify YourLibrary.json, Apple Library.xml, and CSV', () => {
  const spotifyJson = JSON.stringify({
    tracks: [
      { artist: 'Lumen', album: 'Glass', track: 'Windowpane', uri: 'spotify:track:abc123' },
    ],
  });
  const fromSpotify = parseImportedFile('YourLibrary.json', spotifyJson);
  assert.equal(fromSpotify.length, 1);
  assert.equal(fromSpotify[0].track_name, 'Windowpane');
  assert.equal(fromSpotify[0].source_url, 'https://open.spotify.com/track/abc123');

  const appleXml = `<?xml version="1.0"?><plist><dict><key>Tracks</key><dict><key>101</key><dict>
    <key>Name</key><string>Morning Ferry</string>
    <key>Artist</key><string>Soren Vale</string>
    <key>Album</key><string>North Sound</string>
    <key>Total Time</key><integer>214000</integer>
    <key>Location</key><string>file:///Music/morning-ferry.m4a</string>
  </dict></dict></dict></plist>`;
  const fromApple = parseImportedFile('Library.xml', appleXml);
  assert.equal(fromApple.length, 1);
  assert.equal(fromApple[0].track_name, 'Morning Ferry');
  assert.equal(fromApple[0].duration, '3:34');
  assert.equal(fromApple[0].status, 'matched_local');

  const csvText =
    'index,track_name,artist,album,duration,source_url,playlist_name,media_url,status\n' +
    '1,"Night Train",Bramwell,Depot,4:05,,Commute,,pending';
  const fromCsv = parseImportedFile('tracks.csv', csvText);
  assert.equal(fromCsv.length, 1);
  assert.equal(fromCsv[0].track_name, 'Night Train');
  assert.equal(fromCsv[0].artist, 'Bramwell');
});

test('filterAndSortTracks handles filters, search query, and sorting by artist/album/date', () => {
  const dateMap = { t1: '2026-10-12', t2: '2026-11-05', t3: '2026-09-20' };

  const localOnly = filterAndSortTracks(sampleTracks, {
    query: '',
    filter: 'local',
    playlist: 'all',
    sortBy: 'index',
    sortDir: 'asc',
    dateMap,
  });
  assert.deepEqual(
    localOnly.map((t) => t.id),
    ['t1']
  );

  const byArtist = filterAndSortTracks(sampleTracks, {
    query: '',
    filter: 'all',
    playlist: 'all',
    sortBy: 'artist',
    sortDir: 'asc',
    dateMap,
  });
  assert.deepEqual(
    byArtist.map((t) => t.artist),
    ['Anselm Trio', 'Kora Vance', 'Maren Sol']
  );

  const byDateDesc = filterAndSortTracks(sampleTracks, {
    query: '',
    filter: 'all',
    playlist: 'all',
    sortBy: 'date',
    sortDir: 'desc',
    dateMap,
  });
  assert.deepEqual(
    byDateDesc.map((t) => t.id),
    ['t2', 't1', 't3']
  );
});

test('computeLibraryStats and filterAndSortDriveFiles compute accurate counts and ordering', () => {
  const stats = computeLibraryStats(sampleTracks, 4);
  assert.equal(stats.totalSongs, 3);
  assert.equal(stats.deduplicatedCount, 4);
  assert.equal(stats.localReadyCount, 1);
  assert.equal(stats.cloudReadyCount, 1);
  assert.equal(stats.pinnedCount, 1);

  const driveSorted = filterAndSortDriveFiles(
    [
      {
        id: 'd1',
        folderId: 'f1',
        fileName: 'b.flac',
        trackName: 'B',
        artist: 'Zara',
        album: 'Alpha',
        sizeMb: 28,
        modifiedDate: '2026-10-01',
        format: 'FLAC',
        isPinnedOffline: false,
      },
      {
        id: 'd2',
        folderId: 'f1',
        fileName: 'a.flac',
        trackName: 'A',
        artist: 'Clara',
        album: 'Zeta',
        sizeMb: 31,
        modifiedDate: '2026-11-15',
        format: 'FLAC',
        isPinnedOffline: true,
      },
    ],
    { query: '', sortBy: 'date', sortDir: 'desc' }
  );
  assert.equal(driveSorted[0].id, 'd2');
});

test('playlist CRUD helpers create, rename, add/remove tracks, and delete cleanly', async () => {
  const {
    createPlaylistRecord,
    renamePlaylistRecord,
    addTrackToPlaylistRecord,
    removeTrackFromPlaylistRecord,
    deletePlaylistRecord,
  } = await import('./libraryUtils');

  const emptyErr = createPlaylistRecord([], '   ');
  assert.ok(emptyErr.error);

  const created = createPlaylistRecord([], 'Roadtrip Vinyl', ['t1']);
  assert.equal(created.error, undefined);
  assert.equal(created.playlists.length, 1);
  assert.deepEqual(created.playlists[0].trackIds, ['t1']);

  const dupErr = createPlaylistRecord(created.playlists, 'roadtrip vinyl');
  assert.ok(dupErr.error);

  const added = addTrackToPlaylistRecord(
    created.playlists,
    sampleTracks,
    created.playlists[0].id,
    't2'
  );
  assert.deepEqual(added.playlists[0].trackIds, ['t1', 't2']);

  const renamed = renamePlaylistRecord(
    added.playlists,
    added.tracks,
    created.playlists[0].id,
    'Night Drive'
  );
  assert.equal(renamed.error, undefined);
  assert.equal(renamed.playlists[0].name, 'Night Drive');

  const removedTrack = removeTrackFromPlaylistRecord(
    renamed.playlists,
    renamed.tracks,
    created.playlists[0].id,
    't1'
  );
  assert.deepEqual(removedTrack.playlists[0].trackIds, ['t2']);

  const deleted = deletePlaylistRecord(
    removedTrack.playlists,
    removedTrack.tracks,
    created.playlists[0].id
  );
  assert.equal(deleted.playlists.length, 0);
});

test('computePlaylistAnalytics computes per-playlist total, local, cloud, and unassigned counts', async () => {
  const { computePlaylistAnalytics } = await import('./libraryUtils');
  const playlists = [
    {
      id: 'pl-1',
      name: 'Late Night Analog',
      trackIds: ['t1', 't2'],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-10',
    },
    {
      id: 'pl-2',
      name: 'Empty Mix',
      trackIds: [],
      createdAt: '2026-11-05',
      updatedAt: '2026-11-05',
    },
  ];

  const rows = computePlaylistAnalytics(sampleTracks, playlists);
  assert.equal(rows.length, 3);

  assert.equal(rows[0].playlistName, 'Late Night Analog');
  assert.equal(rows[0].totalSongs, 2);
  assert.equal(rows[0].localCount, 1);
  assert.equal(rows[0].cloudCount, 1);
  assert.equal(rows[0].pinnedCount, 1);
  assert.equal(rows[0].otherCount, 0);

  assert.equal(rows[1].playlistName, 'Empty Mix');
  assert.equal(rows[1].totalSongs, 0);

  assert.equal(rows[2].playlistName, 'Unassigned');
  assert.equal(rows[2].totalSongs, 1);
  assert.equal(rows[2].localCount, 0);
  assert.equal(rows[2].cloudCount, 0);
  assert.equal(rows[2].otherCount, 1);
});

