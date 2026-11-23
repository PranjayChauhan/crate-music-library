import { describe, expect, it } from 'vitest';
import type { TrackRecord } from '../types';
import { SequentialTaskRunner } from './SequentialTaskRunner';

function makeTrack(overrides: Partial<TrackRecord> & { id: string; index: number }): TrackRecord {
  return {
    track_name: `Track ${overrides.index}`,
    artist: 'Test Artist',
    album: 'Test Album',
    duration: '3:30',
    source_url: '',
    playlist_name: 'Test Playlist',
    media_url: `https://cdn.example.org/audio/track-${overrides.index}.mp3`,
    status: 'pending',
    ...overrides,
  };
}

describe('SequentialTaskRunner', () => {
  it('enforces strictly 1-by-1 concurrency (maxConcurrent === 1) and resolves local vs download vs skip', async () => {
    const tracks: TrackRecord[] = [
      makeTrack({ id: 't1', index: 1, track_name: 'Local Match Song' }),
      makeTrack({ id: 't2', index: 2, track_name: 'Download Song' }),
      makeTrack({ id: 't3', index: 3, track_name: 'No Media Song', media_url: '' }),
      makeTrack({ id: 't4', index: 4, track_name: 'Download Song 2' }),
    ];

    let inFlight = 0;
    let maxConcurrent = 0;
    const processedOrder: string[] = [];

    const runner = new SequentialTaskRunner(tracks, {
      matchLocal: async (track) => {
        if (track.id === 't1') {
          return {
            matched: true,
            media_url: '/api/local/stream/abc123',
            storage_provider: 'local_server',
          };
        }
        return { matched: false };
      },
      downloadAuthorized: async (track, _signal, onProgress) => {
        inFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        processedOrder.push(track.id);
        onProgress(50);
        await new Promise((r) => setTimeout(r, 20));
        onProgress(100);
        inFlight -= 1;
        return {
          media_url: `/api/local/stream/${track.id}`,
          storage_provider: 'local_server',
        };
      },
    });

    await runner.start();

    expect(maxConcurrent).toBe(1);
    expect(processedOrder).toEqual(['t2', 't4']);
    expect(runner.getState()).toBe('completed');

    const final = runner.getTracks();
    expect(final.find((t) => t.id === 't1')?.status).toBe('matched_local');
    expect(final.find((t) => t.id === 't2')?.status).toBe('downloaded');
    expect(final.find((t) => t.id === 't3')?.status).toBe('skipped');
    expect(final.find((t) => t.id === 't4')?.status).toBe('downloaded');
  });

  it('supports pause, skipCurrent, and retryFailed transitions cleanly', async () => {
    const tracks: TrackRecord[] = [
      makeTrack({ id: 't1', index: 1 }),
      makeTrack({ id: 't2', index: 2 }),
    ];

    let failFirst = true;

    const runner = new SequentialTaskRunner(tracks, {
      matchLocal: async () => ({ matched: false }),
      downloadAuthorized: async (track, signal) => {
        if (track.id === 't1' && failFirst) {
          failFirst = false;
          throw new Error('HTTP 503 temporary error');
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 40);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            },
            { once: true }
          );
        });
        return { media_url: `/api/local/stream/${track.id}`, storage_provider: 'local_server' };
      },
    });

    const run1 = runner.start();
    // Skip t2 once t1 fails and t2 begins
    await new Promise((r) => setTimeout(r, 10));
    runner.skipCurrent();
    await run1;

    expect(runner.getTracks().find((t) => t.id === 't1')?.status).toBe('failed');
    expect(runner.getTracks().find((t) => t.id === 't2')?.status).toBe('skipped');

    // Retry failed -> t1 should now succeed
    runner.retryFailed();
    expect(runner.getTracks().find((t) => t.id === 't1')?.status).toBe('pending');
    await runner.start();
    expect(runner.getTracks().find((t) => t.id === 't1')?.status).toBe('downloaded');
  });
});
