import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  FolderOpen,
  HardDrive,
  KeyRound,
  RefreshCw,
  Server,
  Upload,
  X,
} from 'lucide-react';
import { getSpotifyRedirectUri } from '../services/spotifyPkce';

export interface AppSettings {
  spotifyClientId: string;
  googleDriveClientId: string;
  localFolderPath: string;
  customSearchUrlTemplate?: string;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => void;
  helperOnline: boolean;
  helperFolder: string;
  scannedCount: number;
  onApplyLocalFolder: (folderPath: string) => Promise<void>;
  onAddBrowserAudioFiles: (files: FileList) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onSaveSettings,
  helperOnline,
  helperFolder,
  scannedCount,
  onApplyLocalFolder,
  onAddBrowserAudioFiles,
}) => {
  const [spotifyClientId, setSpotifyClientId] = useState(settings.spotifyClientId);
  const [googleDriveClientId, setGoogleDriveClientId] = useState(settings.googleDriveClientId);
  const [localFolderPath, setLocalFolderPath] = useState(
    settings.localFolderPath || helperFolder
  );
  const [customSearchUrlTemplate, setCustomSearchUrlTemplate] = useState(
    settings.customSearchUrlTemplate ?? 'https://www.google.com/search?q={query}'
  );
  const [savingFolder, setSavingFolder] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Keep draft inputs synced whenever modal re-opens or helperFolder finishes loading
  useEffect(() => {
    if (!open) return;
    setSpotifyClientId(settings.spotifyClientId);
    setGoogleDriveClientId(settings.googleDriveClientId);
    setLocalFolderPath(settings.localFolderPath || helperFolder);
    setCustomSearchUrlTemplate(
      settings.customSearchUrlTemplate ?? 'https://www.google.com/search?q={query}'
    );
    setStatusMsg(null);
  }, [open, settings, helperFolder]);

  if (!open) return null;

  const redirectUri = getSpotifyRedirectUri();

  const handleSave = () => {
    onSaveSettings({
      spotifyClientId: spotifyClientId.trim(),
      googleDriveClientId: googleDriveClientId.trim(),
      localFolderPath: localFolderPath.trim(),
      customSearchUrlTemplate: customSearchUrlTemplate.trim(),
    });
    setStatusMsg('Settings saved locally in your browser.');
  };

  const handleFolderApply = async () => {
    if (!localFolderPath.trim()) return;
    setSavingFolder(true);
    setStatusMsg(null);
    try {
      await onApplyLocalFolder(localFolderPath.trim());
      onSaveSettings({
        spotifyClientId: spotifyClientId.trim(),
        googleDriveClientId: googleDriveClientId.trim(),
        localFolderPath: localFolderPath.trim(),
        customSearchUrlTemplate: customSearchUrlTemplate.trim(),
      });
      setStatusMsg('Local folder connected and scanned.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Unable to connect local folder.');
    } finally {
      setSavingFolder(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crate Backend & API Settings"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#03045e]/95 border border-[#0096c7]/50 shadow-2xl overflow-hidden text-[#caf0f8]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0077b6]/40">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-[#48cae4]" />
            <h2 className="font-display text-lg font-bold">Backend, Local Folder & OAuth Setup</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#90e0ef] hover:bg-[#023e8a]/70 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {statusMsg && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#00b4d8]/15 border border-[#48cae4]/45 text-xs text-[#caf0f8]">
              <CheckCircle2 className="w-4 h-4 text-[#48cae4] shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* 1. Local Helper & Audio Files */}
          <section className="space-y-3 rounded-xl bg-[#020326]/70 border border-[#0077b6]/35 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#48cae4]" />
                <h3 className="text-sm font-semibold">Local Node.js Helper & Audio Folder</h3>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  helperOnline
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                }`}
              >
                {helperOnline ? `Online (${scannedCount} files)` : 'Offline (Browser-only mode)'}
              </span>
            </div>

            <p className="text-xs text-[#90e0ef]/80">
              When running locally via <code className="text-[#48cae4]">npm run dev</code>, the
              Express helper scans your personal audio folder, streams with HTTP 206 seeking, and
              saves authorized 1-by-1 downloads without browser CORS limits.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={localFolderPath}
                onChange={(e) => setLocalFolderPath(e.target.value)}
                placeholder={helperFolder || 'C:\\Users\\You\\Music\\Crate Library'}
                className="flex-1 px-3 py-2 rounded-lg bg-[#020326] border border-[#0077b6]/50 text-xs text-[#caf0f8] focus:outline-none focus:border-[#48cae4]"
              />
              <button
                type="button"
                disabled={!helperOnline || savingFolder}
                onClick={handleFolderApply}
                className="px-3.5 py-2 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-40 text-[#03045e] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {savingFolder ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5" />
                )}
                Set & Scan Folder
              </button>
            </div>

            <div className="pt-2 border-t border-[#0077b6]/25 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#90e0ef]/80">
                Or pick local audio files directly in the browser (works without local server):
              </span>
              <input
                ref={audioInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.aac,.mp4"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onAddBrowserAudioFiles(e.target.files);
                    setStatusMsg(`Loaded ${e.target.files.length} local audio file(s) into player.`);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-xs font-medium flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Load Local Audio Files
              </button>
            </div>
          </section>

          {/* 2. Spotify OAuth PKCE */}
          <section className="space-y-2.5 rounded-xl bg-[#020326]/70 border border-[#0077b6]/35 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#48cae4]" />
              <h3 className="text-sm font-semibold">Spotify Web API (OAuth 2.0 PKCE)</h3>
            </div>
            <p className="text-xs text-[#90e0ef]/80">
              Optional — needed only for live Spotify sync (account data JSON exports require zero
              setup). Add <code className="text-[#48cae4]">{redirectUri}</code> as a Redirect URI
              in your free Spotify Developer Dashboard app.
            </p>
            <input
              type="text"
              value={spotifyClientId}
              onChange={(e) => setSpotifyClientId(e.target.value)}
              placeholder="Paste your Spotify Client ID (leave blank to use demo sync)"
              className="w-full px-3 py-2 rounded-lg bg-[#020326] border border-[#0077b6]/50 text-xs text-[#caf0f8] focus:outline-none focus:border-[#48cae4]"
            />
          </section>

          {/* 3. Google Drive GIS OAuth */}
          <section className="space-y-2.5 rounded-xl bg-[#020326]/70 border border-[#0077b6]/35 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#48cae4]" />
              <h3 className="text-sm font-semibold">Google Drive Offloading (GIS OAuth)</h3>
            </div>
            <p className="text-xs text-[#90e0ef]/80">
              Enter your free Google Cloud OAuth 2.0 Web Client ID (with Authorized JavaScript
              Origin <code className="text-[#48cae4]">{typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5173'}</code>)
              to stream and pin your own audio files from Google Drive.
            </p>
            <input
              type="text"
              value={googleDriveClientId}
              onChange={(e) => setGoogleDriveClientId(e.target.value)}
              placeholder="Paste your Google Cloud OAuth Client ID (xxx.apps.googleusercontent.com)"
              className="w-full px-3 py-2 rounded-lg bg-[#020326] border border-[#0077b6]/50 text-xs text-[#caf0f8] focus:outline-none focus:border-[#48cae4]"
            />
          </section>

          {/* 4. Custom Web Search URL Template */}
          <section className="space-y-2.5 rounded-xl bg-[#020326]/70 border border-[#0077b6]/35 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#48cae4]" />
              <h3 className="text-sm font-semibold">Custom Web Search URL (For Missing Tracks)</h3>
            </div>
            <p className="text-xs text-[#90e0ef]/80">
              Shown only on tracks not yet stored locally or in Google Drive. Use{' '}
              <code className="text-[#48cae4]">{'{query}'}</code>,{' '}
              <code className="text-[#48cae4]">{'{artist}'}</code>, or{' '}
              <code className="text-[#48cae4]">{'{track}'}</code>.
            </p>
            <input
              type="text"
              value={customSearchUrlTemplate}
              onChange={(e) => setCustomSearchUrlTemplate(e.target.value)}
              placeholder="https://www.google.com/search?q={query}"
              className="w-full px-3 py-2 rounded-lg bg-[#020326] border border-[#0077b6]/50 text-xs text-[#caf0f8] focus:outline-none focus:border-[#48cae4]"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#0077b6]/40 bg-[#020326]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[#90e0ef] hover:bg-[#023e8a]/60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
