import type { SpotifyAccountState, TrackRecord } from '../types';
import { formatSecondsToTime } from '../utils/libraryUtils';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_SCOPES = 'user-library-read playlist-read-private playlist-read-collaborative';
const PKCE_VERIFIER_KEY = 'crate_spotify_pkce_verifier';
const PKCE_STATE_KEY = 'crate_spotify_pkce_state';
const PKCE_CLIENT_ID_KEY = 'crate_spotify_pkce_client_id';

export function getSpotifyRedirectUri(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/callback';
  return `${window.location.origin}/callback`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function startSpotifyPkceLogin(clientId: string): Promise<void> {
  const trimmed = (clientId ?? '').trim();
  if (!trimmed) {
    throw new Error('Spotify Client ID is required for Live OAuth PKCE.');
  }
  const verifier = generateRandomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = generateRandomString(16);

  window.sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(PKCE_STATE_KEY, state);
  window.sessionStorage.setItem(PKCE_CLIENT_ID_KEY, trimmed);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: trimmed,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    redirect_uri: getSpotifyRedirectUri(),
    state,
  });

  window.location.assign(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
}

async function spotifyFetchJson<T>(url: string, accessToken: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 429) {
      const retryAfterSec = Number.parseInt(res.headers.get('Retry-After') ?? '2', 10);
      await new Promise((r) => setTimeout(r, Math.max(1, retryAfterSec) * 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Spotify API error (HTTP ${res.status})`);
    }
    return (await res.json()) as T;
  }
  throw new Error('Spotify API rate limit exceeded.');
}

interface SpotifyApiTrack {
  id: string;
  name: string;
  duration_ms?: number;
  external_urls?: { spotify?: string };
  album?: { name?: string };
  artists?: Array<{ name?: string }>;
}

function mapSpotifyTrack(
  t: SpotifyApiTrack,
  playlistName: string,
  seq: number
): TrackRecord {
  return {
    id: `sp-api-${t.id || seq}-${Date.now().toString(36)}`,
    index: seq,
    track_name: t.name || 'Untitled Track',
    artist: (t.artists ?? []).map((a) => a.name).filter(Boolean).join(', ') || 'Unknown Artist',
    album: t.album?.name || 'Single',
    duration: t.duration_ms ? formatSecondsToTime(Math.round(t.duration_ms / 1000)) : '0:00',
    source_url: t.external_urls?.spotify || (t.id ? `https://open.spotify.com/track/${t.id}` : ''),
    playlist_name: playlistName,
    media_url: '',
    status: 'pending',
  };
}

export async function completeSpotifyPkceCallback(
  search: string
): Promise<{
  account: SpotifyAccountState;
  tracks: TrackRecord[];
} | null> {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    throw new Error(`Spotify authorization cancelled: ${error}`);
  }
  if (!code) return null;

  const expectedState = window.sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = window.sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const clientId = window.sessionStorage.getItem(PKCE_CLIENT_ID_KEY);

  window.sessionStorage.removeItem(PKCE_STATE_KEY);
  window.sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  if (!expectedState || state !== expectedState || !verifier || !clientId) {
    throw new Error('Spotify PKCE state verification failed. Please retry connecting.');
  }

  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getSpotifyRedirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Spotify token exchange failed (HTTP ${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  const profile = await spotifyFetchJson<{ id: string; display_name?: string }>(
    `${SPOTIFY_API_BASE}/me`,
    accessToken
  );

  const imported: TrackRecord[] = [];
  let seq = 1;

  // 1. Paginate Liked Songs
  let nextSavedUrl: string | null = `${SPOTIFY_API_BASE}/me/tracks?limit=50`;
  while (nextSavedUrl) {
    const page: {
      items?: Array<{ track?: SpotifyApiTrack }>;
      next?: string | null;
    } = await spotifyFetchJson(nextSavedUrl, accessToken);
    for (const item of page.items ?? []) {
      if (item.track?.name) {
        imported.push(mapSpotifyTrack(item.track, 'Liked Songs', seq++));
      }
    }
    nextSavedUrl = page.next ?? null;
  }

  // 2. Paginate Playlists & their tracks
  let nextPlUrl: string | null = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;
  while (nextPlUrl) {
    const plPage: {
      items?: Array<{ id: string; name: string }>;
      next?: string | null;
    } = await spotifyFetchJson(nextPlUrl, accessToken);
    for (const pl of plPage.items ?? []) {
      let nextTracksUrl: string | null = `${SPOTIFY_API_BASE}/playlists/${pl.id}/tracks?limit=50`;
      while (nextTracksUrl) {
        const tPage: {
          items?: Array<{ track?: SpotifyApiTrack | null }>;
          next?: string | null;
        } = await spotifyFetchJson(nextTracksUrl, accessToken);
        for (const entry of tPage.items ?? []) {
          if (entry.track?.name) {
            imported.push(mapSpotifyTrack(entry.track, pl.name || 'Spotify Playlist', seq++));
          }
        }
        nextTracksUrl = tPage.next ?? null;
      }
    }
    nextPlUrl = plPage.next ?? null;
  }

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    account: {
      connected: true,
      displayName: profile.display_name || profile.id,
      accountId: profile.id,
      scope: SPOTIFY_SCOPES,
      lastSyncedAt: `Today, ${now}`,
    },
    tracks: imported,
  };
}
