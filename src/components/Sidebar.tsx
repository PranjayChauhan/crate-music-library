import React, { useState } from 'react';
import {
  Cloud,
  Disc3,
  Download,
  FileSpreadsheet,
  Library,
  ListMusic,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react';
import type { NavView, PlaylistRecord } from '../types';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  playlists: PlaylistRecord[];
  selectedPlaylistId: string;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => { error?: string; created?: PlaylistRecord };
  pendingQueueCount: number;
  failedCount: number;
}

const NAV_ITEMS: { id: NavView; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'library', label: 'Library', mobileLabel: 'Library', icon: Library },
  { id: 'import', label: 'Import & CSV', mobileLabel: 'Import', icon: FileSpreadsheet },
  { id: 'queue', label: 'Queue Runner', mobileLabel: 'Queue', icon: Download },
  { id: 'cloud', label: 'Google Drive', mobileLabel: 'Drive', icon: Cloud },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  pendingQueueCount,
  failedCount,
}) => {
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleSubmitNewPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreatePlaylist(newPlaylistName);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    setNewPlaylistName('');
    setCreateError(null);
    setCreatingPlaylist(false);
    if (res.created) {
      onSelectPlaylist(res.created.id);
      onSelectView('library');
    }
  };

  return (
    <>
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        aria-label="Primary navigation"
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen pb-20 overflow-x-hidden overflow-y-auto bg-[#03045e]/95 border-r border-[#0077b6]/40 transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[76px]' : 'w-[248px]'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`border-b border-[#0077b6]/35 shrink-0 ${
            collapsed
              ? 'py-3 px-2 flex flex-col items-center justify-center gap-2'
              : 'h-16 px-4 flex items-center justify-between gap-2'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onSelectPlaylist('all');
              onSelectView('library');
            }}
            className={`flex items-center gap-2.5 text-left min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#48cae4] rounded-lg shrink-0 ${
              collapsed ? 'justify-center min-w-[40px]' : ''
            }`}
            aria-label="Crate home"
          >
            <span className="w-8 h-8 rounded-lg bg-[#00b4d8] text-[#03045e] flex items-center justify-center shrink-0">
              <Disc3 className="w-4 h-4 stroke-[2.25]" aria-hidden="true" />
            </span>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-[#caf0f8] whitespace-nowrap">
                Crate
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`space-y-1 shrink-0 ${collapsed ? 'p-2.5' : 'p-3'}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const badgeCount = item.id === 'queue' ? pendingQueueCount + failedCount : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                className={`w-full min-h-[44px] rounded-lg flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#023e8a] text-[#caf0f8]'
                    : 'text-[#90e0ef]/80 hover:text-[#caf0f8] hover:bg-[#023e8a]/50'
                } ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? 'text-[#48cae4]' : 'text-[#90e0ef]/80'
                    }`}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && badgeCount > 0 && (
                  <span className="font-mono text-xs tabular-nums text-[#90e0ef]">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Playlists Section */}
        <div className="mt-2 pt-3 border-t border-[#0077b6]/35 flex-1 flex flex-col min-h-0 px-3">
          {!collapsed ? (
            <>
              <div className="flex items-center justify-between px-2 mb-2 shrink-0">
                <span className="text-xs font-medium text-[#90e0ef]/80">Playlists</span>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingPlaylist((prev) => !prev);
                    setCreateError(null);
                  }}
                  aria-label="Create new playlist"
                  className="min-h-[32px] px-2 rounded-md text-xs font-medium text-[#ade8f4] hover:text-[#caf0f8] hover:bg-[#023e8a] flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  {creatingPlaylist ? (
                    <>
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      New
                    </>
                  )}
                </button>
              </div>

              {creatingPlaylist && (
                <form onSubmit={handleSubmitNewPlaylist} className="mb-3 px-1 space-y-2 shrink-0">
                  <label htmlFor="sidebar-new-playlist" className="sr-only">
                    New playlist name
                  </label>
                  <input
                    id="sidebar-new-playlist"
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => {
                      setNewPlaylistName(e.target.value);
                      if (createError) setCreateError(null);
                    }}
                    placeholder="Playlist name..."
                    autoFocus
                    className="w-full h-9 px-2.5 text-sm bg-[#020326] border border-[#0077b6]/70 rounded-md text-[#caf0f8] placeholder:text-[#90e0ef]/50 focus:border-[#48cae4] focus:outline-none"
                  />
                  {createError && (
                    <p className="text-xs text-rose-300" role="alert">
                      {createError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full h-8 rounded-md bg-[#00b4d8] hover:bg-[#48cae4] text-[#03045e] text-xs font-semibold transition-colors"
                  >
                    Create Playlist
                  </button>
                </form>
              )}

              <div className="overflow-y-auto space-y-0.5 pb-4 pr-1 flex-1 min-h-0">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPlaylist('all');
                    onSelectView('library');
                  }}
                  className={`w-full min-h-[38px] px-2.5 rounded-md flex items-center justify-between text-sm transition-colors ${
                    activeView === 'library' && selectedPlaylistId === 'all'
                      ? 'bg-[#023e8a] text-[#caf0f8] font-medium'
                      : 'text-[#90e0ef]/80 hover:text-[#caf0f8] hover:bg-[#023e8a]/45'
                  }`}
                >
                  <span className="truncate">All Tracks</span>
                </button>

                {playlists.map((pl) => {
                  const selected = activeView === 'library' && selectedPlaylistId === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        onSelectPlaylist(pl.id);
                        onSelectView('library');
                      }}
                      className={`w-full min-h-[38px] px-2.5 rounded-md flex items-center justify-between gap-2 text-sm transition-colors ${
                        selected
                          ? 'bg-[#023e8a] text-[#48cae4] font-medium'
                          : 'text-[#90e0ef]/80 hover:text-[#caf0f8] hover:bg-[#023e8a]/45'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ListMusic className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
                        <span className="truncate">{pl.name}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[#90e0ef]/70 shrink-0">
                        {pl.trackIds.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onToggleCollapse();
                  setCreatingPlaylist(true);
                }}
                aria-label="Create new playlist"
                title="Create new playlist"
                className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[#90e0ef] hover:text-[#caf0f8] hover:bg-[#023e8a] transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Fixed Bottom Tab Bar (Native PWA / Capacitor feel) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#020326]/95 backdrop-blur-md border-t border-[#0077b6]/45 pb-safe"
      >
        <div className="grid grid-cols-4 h-14">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-[#48cae4]' : 'text-[#90e0ef]/70 active:text-[#caf0f8]'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
