import type { StorageProvider as StorageProviderType } from '../types';

export interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  modifiedAt?: string;
  provider: StorageProviderType;
  parentId?: string;
  streamUrl?: string;
}

export interface PlayableResource {
  url: string;
  revoke?: () => void;
}

/**
 * Pluggable storage provider interface.
 * Implemented by LocalStorageProvider and GoogleDriveProvider,
 * and extensible to WebDAV or other official cloud APIs later.
 */
export interface IStorageProvider {
  readonly id: StorageProviderType;
  readonly label: string;
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listAudioFiles(folderId?: string): Promise<StorageFile[]>;
  getPlayableUrl(fileId: string): Promise<PlayableResource>;
  downloadFile(
    fileId: string,
    onProgress?: (loaded: number, total?: number) => void
  ): Promise<Blob>;
  uploadFile?(file: Blob, filename: string, folderId?: string): Promise<StorageFile>;
}
