import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Disc3,
  ExternalLink,
  FileJson,
  FolderOpen,
  KeyRound,
  Music,
  Upload,
  X,
} from 'lucide-react';
import { getSpotifyRedirectUri } from '../services/spotifyPkce';

interface OnboardingModalProps {
  open: boolean;
  spotifyClientId: string;
  isConnectingSpotify: boolean;
  onClose: () => void;
  onSaveSpotifyClientId: (clientId: string) => void;
  onConnectSpotify: (overrideClientId?: string) => void;
  onImportFiles: (files: FileList) => Promise<void>;
  onAddLocalAudioFiles: (files: FileList) => void;
  onLoadSampleSpotify: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  spotifyClientId,
  isConnectingSpotify,
  onClose,
  onSaveSpotifyClientId,
  onConnectSpotify,
  onImportFiles,
  onAddLocalAudioFiles,
  onLoadSampleSpotify,
}) => {
  const [clientIdDraft, setClientIdDraft] = useState(spotifyClientId);
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const exportInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleExportSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusyMessage('Importing track list...');
    try {
      await onImportFiles(files);
      onClose();
    } finally {
      setBusyMessage(null);
    }
  };

  const handleAudioSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onAddLocalAudioFiles(files);
    onClose();
  };

  const handleSpotifyClick = () => {
    const trimmed = clientIdDraft.trim();
    if (trimmed && trimmed !== spotifyClientId) {
      onSaveSpotifyClientId(trimmed);
    }
    onConnectSpotify(trimmed || undefined);
    if (!trimmed) {
      // Demo sync completes in-app; close welcome modal so user lands right in their library
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#020326]/85 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Crate — Import your music library"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#03045e] border border-[#0096c7]/65 shadow-2xl text-[#caf0f8]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-5 border-b border-[#0077b6]/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#00b4d8] text-[#03045e] flex items-center justify-center shrink-0">
              <Disc3 className="w-5 h-5 stroke-[2.25]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">
                Welcome to Crate
              </h2>
              <p className="text-xs sm:text-sm text-[#90e0ef]/85 mt-0.5">
                Start by importing your song names from Spotify, Apple Music, or your local audio
                folder.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip welcome setup"
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 sm:p-6 space-y-3.5">
          {busyMessage && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#00b4d8]/15 border border-[#48cae4]/45 text-xs text-[#caf0f8]">
              {busyMessage}
            </div>
          )}

          {/* Option 1: Spotify Account Export (Zero Setup) */}
          <div className="rounded-xl bg-[#020326]/75 border border-[#0077b6]/45 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileJson className="w-5 h-5 text-[#48cae4] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#caf0f8]">
                  Import Spotify / Apple Music Export File (Fastest)
                </h3>
                <p className="text-xs text-[#90e0ef]/80 mt-0.5">
                  Pick <code className="text-[#ade8f4]">YourLibrary.json</code>,{' '}
                  <code className="text-[#ade8f4]">Playlist*.json</code>, Apple{' '}
                  <code className="text-[#ade8f4]">Library.xml</code>, or a{' '}
                  <code className="text-[#ade8f4]">.csv</code> file. Imports all song names
                  immediately with zero setup.
                </p>
              </div>
            </div>

            <input
              ref={exportInputRef}
              type="file"
              multiple
              accept=".json,.xml,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                void handleExportSelection(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportInputRef.current?.click()}
                className="min-h-[42px] px-4 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Choose Spotify / Apple File
              </button>
              <a
                href="https://exportify.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-3.5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] border border-[#0096c7]/45 text-[#caf0f8] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#48cae4]" aria-hidden="true" />
                Export Free via Exportify
              </a>
              <button
                type="button"
                onClick={() => {
                  onLoadSampleSpotify();
                  onClose();
                }}
                className="min-h-[42px] px-3.5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-xs font-medium transition-colors"
              >
                Try Sample Spotify Playlist
              </button>
            </div>
          </div>

          {/* Option 2: Spotify Live API (OAuth PKCE) */}
          <div className="rounded-xl bg-[#020326]/75 border border-[#0077b6]/45 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-[#48cae4] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#caf0f8]">
                  Connect Spotify Account (OAuth PKCE)
                </h3>
                <p className="text-xs text-[#90e0ef]/80 mt-0.5">
                  Syncs your Liked Songs &amp; Playlists directly via Spotify&apos;s official API
                  (needs a free Spotify Client ID with redirect{' '}
                  <code className="text-[#ade8f4]">{getSpotifyRedirectUri()}</code>, or runs a
                  quick demo sync if blank).
                </p>
              </div>
            </div>

            {showClientIdInput && (
              <input
                type="text"
                value={clientIdDraft}
                onChange={(e) => setClientIdDraft(e.target.value)}
                placeholder="Optional: Paste your Spotify Client ID"
                className="w-full min-h-[40px] px-3 rounded-lg bg-[#03045e]/80 border border-[#0077b6]/60 text-xs text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isConnectingSpotify}
                onClick={handleSpotifyClick}
                className="min-h-[42px] px-4 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] disabled:opacity-50 text-[#caf0f8] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <Music className="w-4 h-4 text-[#48cae4]" aria-hidden="true" />
                {isConnectingSpotify
                  ? 'Connecting...'
                  : clientIdDraft.trim()
                    ? 'Connect Live Spotify'
                    : 'Sync Spotify (Demo / PKCE)'}
              </button>
              <button
                type="button"
                onClick={() => setShowClientIdInput((s) => !s)}
                className="min-h-[42px] px-3 rounded-lg border border-[#0077b6]/55 text-xs text-[#90e0ef] hover:text-[#caf0f8] transition-colors"
              >
                {showClientIdInput ? 'Hide Client ID' : 'Enter Spotify Client ID'}
              </button>
            </div>
          </div>

          {/* Option 3: Local Audio Files */}
          <div className="rounded-xl bg-[#020326]/75 border border-[#0077b6]/45 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-[#48cae4] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-[#caf0f8]">
                  Load Local Audio Files (.mp3 / .m4a / .flac)
                </h3>
                <p className="text-xs text-[#90e0ef]/80 mt-0.5">
                  Pick owned music files already on your phone or PC to play immediately.
                </p>
              </div>
            </div>

            <input
              ref={audioInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.aac,.mp4"
              className="hidden"
              onChange={(e) => {
                handleAudioSelection(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="min-h-[42px] px-3.5 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Pick Audio Files
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#0077b6]/40 bg-[#020326]/60 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#90e0ef]/75">
            Missing songs show a Search button so you can look them up anytime.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-lg text-xs font-semibold text-[#48cae4] hover:bg-[#023e8a]/70 flex items-center gap-1.5 whitespace-nowrap"
          >
            Skip to Library
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
