import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface PinnedAudioEntry {
  trackId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pinnedAt: string;
  blob: Blob;
}

interface CrateOfflineDB extends DBSchema {
  pinned_audio: {
    key: string;
    value: PinnedAudioEntry;
  };
}

const DB_NAME = 'crate-offline-audio-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CrateOfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CrateOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CrateOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pinned_audio')) {
          db.createObjectStore('pinned_audio', { keyPath: 'trackId' });
        }
      },
    });
  }
  return dbPromise;
}

export const OfflinePinStore = {
  async pinAudio(
    trackId: string,
    blob: Blob,
    fileName: string
  ): Promise<PinnedAudioEntry> {
    const db = await getDb();
    const entry: PinnedAudioEntry = {
      trackId,
      fileName,
      mimeType: blob.type || 'audio/mpeg',
      sizeBytes: blob.size,
      pinnedAt: new Date().toISOString(),
      blob,
    };
    await db.put('pinned_audio', entry);
    return entry;
  },

  async getPinnedAudio(trackId: string): Promise<PinnedAudioEntry | undefined> {
    const db = await getDb();
    return db.get('pinned_audio', trackId);
  },

  async hasPinnedAudio(trackId: string): Promise<boolean> {
    const db = await getDb();
    const key = await db.getKey('pinned_audio', trackId);
    return key !== undefined;
  },

  async unpinAudio(trackId: string): Promise<void> {
    const db = await getDb();
    await db.delete('pinned_audio', trackId);
  },

  async listPinnedIds(): Promise<string[]> {
    const db = await getDb();
    return db.getAllKeys('pinned_audio');
  },

  async getTotalPinnedBytes(): Promise<number> {
    const db = await getDb();
    const all = await db.getAll('pinned_audio');
    return all.reduce((sum, item) => sum + item.sizeBytes, 0);
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('pinned_audio');
  },
};
