import { describe, expect, it } from 'vitest';
import {
  inferAudioExtension,
  isDirectAuthorizedMediaUrl,
  normalizeMatchKey,
  sanitizeTrackFilename,
} from './filenameSanitizer';

describe('filenameSanitizer', () => {
  it('formats zero-padded index, strips illegal chars, and infers extension', () => {
    const name = sanitizeTrackFilename(
      1,
      'Kora: Vance?',
      'Rain/on*Mercer <Street>',
      'https://cdn.example.org/audio/rain.flac'
    );
    expect(name).toBe('001 - Kora Vance - Rain on Mercer Street.flac');
  });

  it('guards against Windows reserved names like CON or NUL', () => {
    const name = sanitizeTrackFilename(12, 'CON', 'NUL', undefined, 'audio/mpeg');
    expect(name).toBe('012 - Unknown Artist - Untitled Track.mp3');
  });

  it('infers extensions from MIME types when URL has no extension', () => {
    expect(inferAudioExtension('https://cdn.example.org/stream?id=42', 'audio/mp4')).toBe('.m4a');
    expect(inferAudioExtension('https://cdn.example.org/stream?id=42', 'video/mp4')).toBe('.mp4');
    expect(inferAudioExtension('https://cdn.example.org/stream?id=42', 'audio/ogg; codecs=opus')).toBe('.ogg');
  });

  it('validates direct authorized media URLs and blocks streaming storefronts', () => {
    expect(isDirectAuthorizedMediaUrl('https://archive.org/download/cc-track/song.mp3').valid).toBe(true);
    expect(isDirectAuthorizedMediaUrl('https://www.youtube.com/watch?v=abc').valid).toBe(false);
    expect(isDirectAuthorizedMediaUrl('https://open.spotify.com/track/123').valid).toBe(false);
    expect(isDirectAuthorizedMediaUrl('https://music.apple.com/us/album/xyz').valid).toBe(false);
    expect(isDirectAuthorizedMediaUrl('ftp://files.example.org/song.mp3').valid).toBe(false);
    expect(isDirectAuthorizedMediaUrl('').valid).toBe(false);
  });

  it('normalizes match keys consistently across punctuation and extensions', () => {
    expect(normalizeMatchKey('001 - Kora Vance - Rain on Mercer.flac')).toBe(
      '001 kora vance rain on mercer'
    );
  });
});
