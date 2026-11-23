import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { ImportSummary, SpotifyAccountState, TrackRecord } from '../types';
import { CSV_COLUMNS, exportTracksToCsv } from '../utils/libraryUtils';

interface ImportCsvViewProps {
  tracks: TrackRecord[];
  spotifyState: SpotifyAccountState;
  isConnectingSpotify: boolean;
  importHistory: ImportSummary[];
  onConnectSpotify: () => void;
  onImportRawContent: (filename: string, content: string) => void;
  onLoadSampleExport: (preset: 'spotify' | 'apple' | 'csv') => void;
}

export const ImportCsvView: React.FC<ImportCsvViewProps> = ({
  tracks,
  spotifyState,
  isConnectingSpotify,
  importHistory,
  onConnectSpotify,
  onImportRawContent,
  onLoadSampleExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!exportMessage) return;
    const timer = window.setTimeout(() => setExportMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [exportMessage]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    for (const file of Array.from(fileList)) {
      const lower = file.name.toLowerCase();
      if (
        !lower.endsWith('.json') &&
        !lower.endsWith('.xml') &&
        !lower.endsWith('.csv') &&
        !lower.endsWith('.txt')
      ) {
        setUploadError(
          `Unsupported file "${file.name}". Please drop YourLibrary.json, Playlist*.json, Library.xml, .csv, or .txt exports.`
        );
        continue;
      }
      const text = await file.text();
      onImportRawContent(file.name, text);
    }
  };

  const handleExportCsv = () => {
    const csvContent = exportTracksToCsv(tracks, true);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crate-library-utf8-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportMessage(`Exported ${tracks.length} tracks as UTF-8 CSV.`);
  };

  const csvPreviewRows = exportTracksToCsv(tracks.slice(0, 4)).split('\n');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#0077b6]/35 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#caf0f8]">
            Import & CSV
          </h1>
          <p className="text-sm text-[#90e0ef]/80 mt-1.5 max-w-2xl">
            Import metadata from official Spotify or Apple Music data exports, connect via OAuth
            PKCE, or export your normalized personal library as UTF-8 CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={tracks.length === 0}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-40 text-[#03045e] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export UTF-8 CSV
        </button>
      </div>

      {exportMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#00b4d8]/15 border border-[#48cae4]/45 text-sm text-[#caf0f8]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#48cae4]" aria-hidden="true" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Primary Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Drag-and-Drop Export Upload Zone */}
        <section
          aria-label="Drag and drop library import"
          className="lg:col-span-7 bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-[#caf0f8]">
              Official Export Drop Zone
            </h2>
            <p className="text-xs text-[#90e0ef]/80 mt-1">
              Supports Spotify (<span className="font-mono text-[#ade8f4]">YourLibrary.json</span>,{' '}
              <span className="font-mono text-[#ade8f4]">Playlist*.json</span>), Apple Music (
              <span className="font-mono text-[#ade8f4]">Library.xml</span>,{' '}
              <span className="font-mono text-[#ade8f4]">.csv/.txt</span>), and UTF-8 CSV files.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={`mt-4 rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
                isDragging
                  ? 'border-[#48cae4] bg-[#00b4d8]/15'
                  : 'border-[#0077b6]/60 bg-[#020326]/65 hover:border-[#0096c7]'
              }`}
            >
              <Upload className="w-7 h-7 text-[#48cae4] mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-[#caf0f8]">
                Drag and drop export files here
              </p>
              <p className="text-xs text-[#90e0ef]/70 mt-1">
                Duplicates by track title and artist are automatically merged.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.xml,.csv,.txt"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = '';
                }}
                className="sr-only"
                aria-label="Choose export files to import"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 min-h-[44px] px-4 py-2 rounded-lg bg-[#023e8a] hover:bg-[#0077b6] text-[#caf0f8] text-sm font-medium transition-colors whitespace-nowrap"
              >
                Browse Local Files
              </button>
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-rose-300" role="alert">
                {uploadError}
              </p>
            )}
          </div>

          {/* Free Spotify Export via Exportify + Quick Sample Imports */}
          <div className="mt-5 pt-4 border-t border-[#0077b6]/35 space-y-4">
            <div className="rounded-xl bg-[#020326]/80 border border-[#0096c7]/45 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#caf0f8]">
                  Free Spotify Account? Export via Exportify (No Premium Needed)
                </p>
                <p className="text-[11px] text-[#90e0ef]/80 mt-0.5">
                  1. Open Exportify &amp; log in → 2. Tap <strong>Export</strong> to download a{' '}
                  <code className="text-[#ade8f4]">.csv</code> → 3. Upload it above.
                </p>
              </div>
              <a
                href="https://exportify.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3.5 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Open Exportify
              </a>
            </div>

            <div>
              <p className="text-xs font-medium text-[#90e0ef]/80 mb-2.5">
                Load a sample official export to test parsing and deduplication
              </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onLoadSampleExport('spotify')}
                className="min-h-[40px] px-3 rounded-lg bg-[#020326]/80 hover:bg-[#023e8a] border border-[#0077b6]/45 text-xs font-medium text-[#ade8f4] flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <FileJson className="w-3.5 h-3.5 text-[#48cae4]" aria-hidden="true" />
                Spotify Playlist1.json
              </button>
              <button
                type="button"
                onClick={() => onLoadSampleExport('apple')}
                className="min-h-[40px] px-3 rounded-lg bg-[#020326]/80 hover:bg-[#023e8a] border border-[#0077b6]/45 text-xs font-medium text-[#ade8f4] flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5 text-[#90e0ef]" aria-hidden="true" />
                Apple Library.xml
              </button>
              <button
                type="button"
                onClick={() => onLoadSampleExport('csv')}
                className="min-h-[40px] px-3 rounded-lg bg-[#020326]/80 hover:bg-[#023e8a] border border-[#0077b6]/45 text-xs font-medium text-[#ade8f4] flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#90e0ef]" aria-hidden="true" />
                UTF-8 Tracks.csv
              </button>
            </div>
            </div>
          </div>
        </section>

        {/* Official Spotify OAuth PKCE Card */}
        <section
          aria-label="Spotify OAuth PKCE connection"
          className="lg:col-span-5 bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-6"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#caf0f8]">
                  Official Spotify API Sync
                </h2>
                <p className="text-xs text-[#90e0ef]/80 mt-1">
                  Client-side Authorization Code Flow with PKCE. Imports track metadata and playlist
                  structure only.
                </p>
              </div>
              <KeyRound className="w-5 h-5 text-[#48cae4] shrink-0" aria-hidden="true" />
            </div>

            {spotifyState.connected ? (
              <div className="rounded-xl bg-[#020326]/80 border border-[#0077b6]/45 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#90e0ef]/80">Account</span>
                  <span className="font-medium text-[#caf0f8]">{spotifyState.displayName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#90e0ef]/80 shrink-0">Scopes</span>
                  <span className="font-mono text-[#ade8f4] truncate">{spotifyState.scope}</span>
                </div>
                {spotifyState.lastSyncedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#90e0ef]/80">Last Synced</span>
                    <span className="font-mono tabular-nums text-[#48cae4]">
                      {spotifyState.lastSyncedAt}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-[#020326]/70 border border-[#0077b6]/40 p-4 text-xs text-[#90e0ef]/85 leading-relaxed">
                No client secret required. After authorizing read-only playlist scopes, Crate
                deduplicates incoming entries against your local library index.
              </div>
            )}

            <button
              type="button"
              onClick={onConnectSpotify}
              disabled={isConnectingSpotify}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#00b4d8] hover:bg-[#48cae4] disabled:opacity-60 text-[#03045e] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              {isConnectingSpotify
                ? 'Authorizing PKCE Session...'
                : spotifyState.connected
                  ? 'Re-sync Spotify Playlists (PKCE)'
                  : 'Connect Spotify (OAuth PKCE)'}
            </button>
          </div>

          <div className="pt-4 border-t border-[#0077b6]/35 flex items-start gap-2.5 text-xs text-[#90e0ef]/80">
            <ShieldCheck className="w-4 h-4 text-[#48cae4] shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Crate only organizes user-owned local files, official Spotify/Apple exports and APIs,
              and user-supplied authorized direct media URLs.
            </p>
          </div>
        </section>
      </div>

      {/* Recent Import Activity */}
      {importHistory.length > 0 && (
        <section
          aria-label="Recent imports"
          className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 sm:p-6"
        >
          <h2 className="font-display text-base font-semibold text-[#caf0f8] mb-3">
            Recent Import Results
          </h2>
          <div className="divide-y divide-[#0077b6]/30">
            {importHistory.map((item, idx) => (
              <div
                key={`${item.sourceName}-${idx}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p className="font-medium text-[#caf0f8]">{item.sourceName}</p>
                  <p className="text-xs text-[#90e0ef]/80 mt-0.5 font-mono tabular-nums">
                    {item.totalParsed} parsed · {item.addedCount} added · {item.duplicateCount}{' '}
                    deduplicated
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#90e0ef]/70">
                  {item.timestamp}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* UTF-8 CSV Schema Preview */}
      <section
        aria-label="CSV export column schema"
        className="bg-[#03045e]/85 border border-[#0077b6]/40 rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#caf0f8]">
              UTF-8 CSV Schema Preview
            </h2>
            <p className="text-xs text-[#90e0ef]/80 mt-0.5">
              Exact 9-column header exported for spreadsheet tools or external sync scripts.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-[#90e0ef]/80">
            {CSV_COLUMNS.length} columns · {tracks.length} rows
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl bg-[#020326] border border-[#0077b6]/45 p-4">
          <pre className="font-mono text-xs text-[#ade8f4] leading-relaxed whitespace-pre">
            {csvPreviewRows.join('\n')}
          </pre>
        </div>
      </section>
    </div>
  );
};
