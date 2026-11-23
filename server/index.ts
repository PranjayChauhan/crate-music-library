import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isDirectAuthorizedMediaUrl,
  normalizeMatchKey,
  sanitizeTrackFilename,
} from '../src/utils/filenameSanitizer';

export interface ScannedLocalFile {
  id: string;
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  ext: string;
  matchKey: string;
  streamUrl: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.aac': 'audio/aac',
};

const ALLOWED_DOWNLOAD_MIME_PREFIXES = ['audio/', 'video/mp4', 'application/ogg', 'application/octet-stream'];

function isSupportedExt(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

function makeFileId(relativePath: string): string {
  return crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 16);
}

function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function createLocalHelperApp(initialFolder?: string) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  let activeFolder = path.resolve(
    initialFolder ?? path.join(os.homedir(), 'Music', 'Crate Library')
  );
  const fileIndex = new Map<string, string>(); // fileId -> absolutePath

  async function scanDirectoryRecursive(dir: string, rootDir: string, out: ScannedLocalFile[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDirectoryRecursive(fullPath, rootDir, out);
      } else if (entry.isFile() && isSupportedExt(entry.name)) {
        const stat = await fsp.stat(fullPath);
        const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        const id = makeFileId(rel);
        fileIndex.set(id, fullPath);
        out.push({
          id,
          fileName: entry.name,
          relativePath: rel,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString().slice(0, 10),
          ext: path.extname(entry.name).toLowerCase(),
          matchKey: normalizeMatchKey(entry.name),
          streamUrl: `/api/local/stream/${id}`,
        });
      }
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      activeFolder,
      folderExists: fs.existsSync(activeFolder),
      supportedExtensions: SUPPORTED_AUDIO_EXTENSIONS,
    });
  });

  app.get('/api/local/folder', (_req, res) => {
    res.json({
      folder: activeFolder,
      exists: fs.existsSync(activeFolder),
    });
  });

  app.post('/api/local/folder', async (req, res) => {
    const rawFolder = typeof req.body?.folder === 'string' ? req.body.folder.trim() : '';
    const createIfMissing = Boolean(req.body?.createIfMissing);
    if (!rawFolder) {
      res.status(400).json({ error: 'Folder path is required.' });
      return;
    }

    const resolved = path.resolve(rawFolder);
    try {
      if (!fs.existsSync(resolved)) {
        if (createIfMissing) {
          await fsp.mkdir(resolved, { recursive: true });
        } else {
          res.status(404).json({ error: `Folder does not exist: ${resolved}` });
          return;
        }
      }
      const stat = await fsp.stat(resolved);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: 'Provided path is not a directory.' });
        return;
      }
      activeFolder = resolved;
      fileIndex.clear();
      res.json({ ok: true, folder: activeFolder });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to access folder.',
      });
    }
  });

  app.get('/api/local/scan', async (_req, res) => {
    fileIndex.clear();
    const files: ScannedLocalFile[] = [];
    if (fs.existsSync(activeFolder)) {
      await scanDirectoryRecursive(activeFolder, activeFolder, files);
    }
    res.json({
      folder: activeFolder,
      count: files.length,
      files,
    });
  });

  app.get('/api/local/stream/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const fullPath = fileIndex.get(fileId);
    if (!fullPath || !isPathInside(activeFolder, fullPath) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Audio file not found in active local library.' });
      return;
    }

    const stat = await fsp.stat(fullPath);
    const totalSize = stat.size;
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    const rangeHeader = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }
      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(totalSize - 1, Number.parseInt(match[2], 10)) : totalSize - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(end - start + 1));
      fs.createReadStream(fullPath, { start, end }).pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(totalSize));
    fs.createReadStream(fullPath).pipe(res);
  });

  app.post('/api/local/download', async (req, res) => {
    const index = Number(req.body?.index ?? 1);
    const artist = String(req.body?.artist ?? 'Unknown Artist');
    const trackName = String(req.body?.track_name ?? 'Untitled Track');
    const mediaUrl = String(req.body?.media_url ?? '').trim();

    const validation = isDirectAuthorizedMediaUrl(mediaUrl);
    if (!validation.valid) {
      res.status(400).json({ error: validation.reason ?? 'Invalid media_url.' });
      return;
    }

    const controller = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    try {
      const upstream = await fetch(mediaUrl, {
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        res.status(502).json({
          error: `Upstream returned HTTP ${upstream.status} ${upstream.statusText}`,
        });
        return;
      }

      const contentType = (upstream.headers.get('content-type') ?? '').toLowerCase();
      const hasValidMime =
        !contentType ||
        ALLOWED_DOWNLOAD_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));
      if (!hasValidMime) {
        res.status(415).json({
          error: `Rejected non-audio response MIME type "${contentType}". Only direct authorized audio/MP4 files are supported.`,
        });
        return;
      }

      await fsp.mkdir(activeFolder, { recursive: true });
      const fileName = sanitizeTrackFilename(index, artist, trackName, mediaUrl, contentType);
      const destPath = path.join(activeFolder, fileName);
      if (!isPathInside(activeFolder, destPath)) {
        res.status(400).json({ error: 'Resolved filename escaped target directory.' });
        return;
      }

      const tempPath = `${destPath}.part`;
      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream);
      await pipeline(nodeStream, fs.createWriteStream(tempPath));
      await fsp.rename(tempPath, destPath);

      const stat = await fsp.stat(destPath);
      const rel = path.relative(activeFolder, destPath).replace(/\\/g, '/');
      const fileId = makeFileId(rel);
      fileIndex.set(fileId, destPath);

      res.json({
        ok: true,
        fileId,
        fileName,
        localPath: destPath,
        streamUrl: `/api/local/stream/${fileId}`,
        sizeBytes: stat.size,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        res.status(499).json({ error: 'Download aborted by client.' });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to download authorized media URL.',
      });
    }
  });

  return app;
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.env.PORT ?? 5174);
  const hostArgIndex = process.argv.indexOf('--host');
  const host =
    hostArgIndex >= 0 && process.argv[hostArgIndex + 1]
      ? process.argv[hostArgIndex + 1]
      : process.env.HOST ?? '127.0.0.1';

  const app = createLocalHelperApp();
  app.listen(port, host, () => {
    console.log(`[Crate Local Helper] listening on http://${host}:${port}`);
  });
}
