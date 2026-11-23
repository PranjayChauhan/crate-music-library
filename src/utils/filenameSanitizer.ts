export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.m4a',
  '.mp4',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.aac',
] as const;

const MIME_TO_EXT: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'application/ogg': '.ogg',
  'audio/opus': '.opus',
  'video/mp4': '.mp4',
};

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const BLOCKED_SCRAPING_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'open.spotify.com',
  'play.spotify.com',
  'music.apple.com',
]);

export function sanitizeSegment(raw: string, fallback: string): string {
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');

  if (!cleaned || WINDOWS_RESERVED_RE.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

export function inferAudioExtension(mediaUrl?: string, mimeType?: string): string {
  if (mimeType) {
    const normalizedMime = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (MIME_TO_EXT[normalizedMime]) {
      return MIME_TO_EXT[normalizedMime];
    }
  }

  if (mediaUrl) {
    try {
      const parsed = new URL(mediaUrl);
      const pathname = parsed.pathname.toLowerCase();
      for (const ext of SUPPORTED_AUDIO_EXTENSIONS) {
        if (pathname.endsWith(ext)) {
          return ext;
        }
      }
    } catch {
      const lower = mediaUrl.toLowerCase();
      for (const ext of SUPPORTED_AUDIO_EXTENSIONS) {
        if (lower.endsWith(ext)) {
          return ext;
        }
      }
    }
  }

  return '.mp3';
}

export function sanitizeTrackFilename(
  index: number,
  artist: string,
  trackName: string,
  mediaUrl?: string,
  mimeType?: string
): string {
  const safeIndex = Math.max(1, Math.floor(index || 1))
    .toString()
    .padStart(3, '0');
  const safeArtist = sanitizeSegment(artist, 'Unknown Artist');
  const safeTrack = sanitizeSegment(trackName, 'Untitled Track');
  const ext = inferAudioExtension(mediaUrl, mimeType);

  let base = `${safeIndex} - ${safeArtist} - ${safeTrack}`;
  if (base.length > 180) {
    base = base.slice(0, 180).trim();
  }
  return `${base}${ext}`;
}

export function isDirectAuthorizedMediaUrl(rawUrl: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, reason: 'No media_url provided' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Unsupported protocol "${parsed.protocol}" (only http/https direct media URLs allowed)`,
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_SCRAPING_HOSTS.has(host)) {
    return {
      valid: false,
      reason: `Host "${host}" is a streaming storefront, not a direct authorized audio file URL`,
    };
  }

  return { valid: true };
}

export function normalizeMatchKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
