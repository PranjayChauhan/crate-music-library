import type { IStorageProvider, PlayableResource, StorageFile } from './StorageProvider';

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenError {
  type?: string;
  message?: string;
}

interface GoogleAccountsOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    callback: (resp: GoogleTokenResponse) => void;
    error_callback?: (err: GoogleTokenError) => void;
  }): { requestAccessToken(options?: { prompt?: string }): void };
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const STORAGE_TOKEN_KEY = 'crate_gdrive_token';
const STORAGE_EMAIL_KEY = 'crate_gdrive_email';

async function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

export class GoogleDriveProvider implements IStorageProvider {
  public readonly id = 'gdrive' as const;
  public readonly label = 'Google Drive';

  private clientId: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private accountEmail = '';

  constructor(clientId = '') {
    this.clientId = (clientId ?? '').trim();
    if (typeof window !== 'undefined') {
      try {
        const saved = window.sessionStorage.getItem(STORAGE_TOKEN_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { token: string; expiresAt: number };
          if (parsed.expiresAt > Date.now()) {
            this.accessToken = parsed.token;
            this.tokenExpiresAt = parsed.expiresAt;
          }
        }
        this.accountEmail = window.sessionStorage.getItem(STORAGE_EMAIL_KEY) ?? '';
      } catch {
        // Ignore storage errors
      }
    }
  }

  public setClientId(clientId: string): void {
    this.clientId = (clientId ?? '').trim();
  }

  public getAccountEmail(): string {
    return this.accountEmail;
  }

  public setAccessTokenForTesting(token: string, expiresInSec = 3600): void {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + expiresInSec * 1000;
  }

  public async isConnected(): Promise<boolean> {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  public async connect(): Promise<void> {
    if (!this.clientId) {
      throw new Error(
        'Google Drive Client ID is not configured. Add your free Google Cloud OAuth Client ID in Settings.'
      );
    }
    await loadGisScript();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      throw new Error('Google Identity Services OAuth2 client unavailable.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const isAndroidWebView =
      typeof navigator !== 'undefined' &&
      /\bwv\b|Android.*Version\/[\d.]+/i.test(navigator.userAgent);

    const tokenResp = await new Promise<GoogleTokenResponse>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            `Google sign-in timed out. Make sure popups are allowed and "${origin}" is added to Authorized JavaScript origins in Google Cloud Console.`
          )
        );
      }, 45000);

      const finishReject = (msg: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error(msg));
      };

      const finishResolve = (resp: GoogleTokenResponse) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(resp);
      };

      try {
        const client = oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_SCOPES,
          include_granted_scopes: false,
          callback: (resp) => {
            if (resp.error) {
              finishReject(
                `${resp.error_description || resp.error} (Origin: ${origin})`
              );
            } else {
              finishResolve(resp);
            }
          },
          error_callback: (err) => {
            if (err?.type === 'popup_failed_to_open') {
              finishReject(
                isAndroidWebView
                  ? 'Google blocks OAuth popups inside Android APK WebViews (403 disallowed_useragent). Open CRATE in Chrome on your phone or desktop to connect Google Drive.'
                  : `Popup blocked by browser. Allow popups for ${origin} and try again.`
              );
            } else if (err?.type === 'popup_closed') {
              finishReject('Google sign-in popup was closed before completing authorization.');
            } else {
              finishReject(
                err?.message ||
                  `Google OAuth failed (${err?.type || 'unknown'}). Verify "${origin}" is in Authorized JavaScript origins.`
              );
            }
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        finishReject(
          err instanceof Error ? err.message : 'Failed to initialize Google OAuth client.'
        );
      }
    });

    if (!tokenResp.access_token) {
      throw new Error('Google Drive did not return an access token.');
    }

    this.accessToken = tokenResp.access_token;
    this.tokenExpiresAt = Date.now() + (tokenResp.expires_in ?? 3600) * 1000;
    try {
      window.sessionStorage.setItem(
        STORAGE_TOKEN_KEY,
        JSON.stringify({ token: this.accessToken, expiresAt: this.tokenExpiresAt })
      );
    } catch {
      // ignore
    }

    // Fetch user email cleanly
    try {
      const aboutRes = await fetch(`${DRIVE_API_BASE}/about?fields=user(emailAddress)`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (aboutRes.ok) {
        const about = (await aboutRes.json()) as { user?: { emailAddress?: string } };
        this.accountEmail = about.user?.emailAddress ?? '';
        window.sessionStorage.setItem(STORAGE_EMAIL_KEY, this.accountEmail);
      }
    } catch {
      // non-fatal
    }
  }

  public async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.accountEmail = '';
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      window.sessionStorage.removeItem(STORAGE_EMAIL_KEY);
    }
  }

  private requireToken(): string {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      throw new Error('Google Drive session expired. Please reconnect Google Drive.');
    }
    return this.accessToken;
  }

  public async listAudioFiles(folderId?: string): Promise<StorageFile[]> {
    const token = this.requireToken();
    const audioQuery =
      "(mimeType contains 'audio/' or name contains '.mp3' or name contains '.m4a' or name contains '.flac' or name contains '.wav' or name contains '.ogg' or name contains '.opus')";
    const folderFilter = folderId ? ` and '${folderId}' in parents` : '';
    const q = encodeURIComponent(`trashed = false and ${audioQuery}${folderFilter}`);
    const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,parents)');

    const res = await fetch(
      `${DRIVE_API_BASE}/files?q=${q}&fields=${fields}&pageSize=200&orderBy=modifiedTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      throw new Error(`Google Drive file listing failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType?: string;
        size?: string;
        modifiedTime?: string;
        parents?: string[];
      }>;
    };

    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType ?? 'audio/mpeg',
      sizeBytes: f.size ? Number.parseInt(f.size, 10) : undefined,
      modifiedAt: f.modifiedTime?.slice(0, 10),
      parentId: f.parents?.[0],
      provider: 'gdrive',
    }));
  }

  public async downloadFile(
    fileId: string,
    onProgress?: (loaded: number, total?: number) => void
  ): Promise<Blob> {
    const token = this.requireToken();
    const res = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Google Drive download failed (HTTP ${res.status})`);
    }

    const total = Number.parseInt(res.headers.get('content-length') ?? '0', 10) || undefined;
    if (!res.body || !onProgress) {
      return await res.blob();
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
      }
    }
    return new Blob(chunks, { type: res.headers.get('content-type') || 'audio/mpeg' });
  }

  public async getPlayableUrl(fileId: string): Promise<PlayableResource> {
    const blob = await this.downloadFile(fileId);
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  public async uploadFile(
    file: Blob,
    filename: string,
    folderId?: string
  ): Promise<StorageFile> {
    const token = this.requireToken();
    const metadata: Record<string, unknown> = {
      name: filename,
      mimeType: file.type || 'audio/mpeg',
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file, filename);

    const res = await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,parents`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) {
      throw new Error(`Google Drive upload failed (HTTP ${res.status})`);
    }
    const created = (await res.json()) as {
      id: string;
      name: string;
      mimeType?: string;
      size?: string;
      modifiedTime?: string;
      parents?: string[];
    };

    return {
      id: created.id,
      name: created.name,
      mimeType: created.mimeType ?? 'audio/mpeg',
      sizeBytes: created.size ? Number.parseInt(created.size, 10) : file.size,
      modifiedAt: created.modifiedTime?.slice(0, 10),
      parentId: created.parents?.[0],
      provider: 'gdrive',
    };
  }
}
