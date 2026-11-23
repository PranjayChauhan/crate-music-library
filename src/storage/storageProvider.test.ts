import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { LocalStorageProvider } from './LocalStorageProvider';

describe('Pluggable StorageProviders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('LocalStorageProvider matches tracks against scanned local files', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          folder: '/Music',
          count: 1,
          files: [
            {
              id: 'abc123',
              fileName: '001 - Kora Vance - Rain on Mercer Street.flac',
              relativePath: '001 - Kora Vance - Rain on Mercer Street.flac',
              sizeBytes: 123456,
              modifiedAt: '2026-11-20',
              ext: '.flac',
              matchKey: '001 kora vance rain on mercer street',
              streamUrl: '/api/local/stream/abc123',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const provider = new LocalStorageProvider('http://127.0.0.1:5174');
    const match = await provider.matchTrackInLocalFolder({
      artist: 'Kora Vance',
      track_name: 'Rain on Mercer Street',
    });

    expect(match.matched).toBe(true);
    expect(match.streamUrl).toBe('http://127.0.0.1:5174/api/local/stream/abc123');
    expect(match.provider).toBe('local_server');
  });

  it('GoogleDriveProvider lists audio files using Drive v3 API with Bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          files: [
            {
              id: 'drive-file-1',
              name: 'Nordic Drift - Pine Road.flac',
              mimeType: 'audio/flac',
              size: '30828134',
              modifiedTime: '2026-11-12T10:00:00Z',
              parents: ['folder-1'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const drive = new GoogleDriveProvider('test-client-id');
    drive.setAccessTokenForTesting('fake-token');

    expect(await drive.isConnected()).toBe(true);
    const files = await drive.listAudioFiles('folder-1');
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe('drive-file-1');
    expect(files[0].provider).toBe('gdrive');
    expect(files[0].sizeBytes).toBe(30828134);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://www.googleapis.com/drive/v3/files'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer fake-token' },
      })
    );
  });
});
