import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const ANDROID_MUSIC_DIR = 'CRATE';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio blob to base64'));
    reader.readAsDataURL(blob);
  });
}

export const CapacitorAudioBridge = {
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async saveAudioBlob(fileName: string, blob: Blob): Promise<string> {
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: `${ANDROID_MUSIC_DIR}/${fileName}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    return Capacitor.convertFileSrc(written.uri);
  },

  async listSavedAudioFiles(): Promise<string[]> {
    try {
      const res = await Filesystem.readdir({
        path: ANDROID_MUSIC_DIR,
        directory: Directory.Documents,
      });
      return res.files.map((f) => f.name);
    } catch {
      return [];
    }
  },
};
