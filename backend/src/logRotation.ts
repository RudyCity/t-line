import fs from 'fs';
import path from 'path';

/**
 * Log rotation utilities.
 *
 * The t-line backend writes per-process log files into the user's home
 * directory (e.g. `~/.tline-backend.log`, `~/.tline-superagent.log`).
 * Without bounds, those files can grow to hundreds of MB over weeks of
 * usage. The functions in this module cap on-disk log size.
 *
 * Two strategies are exposed:
 *
 *  - `capLogFile(filePath, maxBytes)` — bounds a single file by truncating
 *    the older half of its contents when the file exceeds `maxBytes`.
 *    Cheap, deterministic, and safe to call at module init.
 *
 *  - `rotateLogs(logsDir, maxFiles)` — directory sweep that keeps only the
 *    N most-recent `superagent-*.log` files (or any matching prefix via
 *    `pattern`), deleting the rest. Intended for any per-session log
 *    directory added in the future.
 */

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const KEEP_LAST_BYTES = Math.floor(DEFAULT_MAX_BYTES / 2); // keep newest 2.5 MB

/**
 * Truncate a single log file in-place when it exceeds `maxBytes`.
 *
 * Strategy: when oversized, keep the trailing `KEEP_LAST_BYTES` of the
 * file (the most recent log lines) and prepend a rotation marker.
 * This is preferable to `fs.writeFileSync('')` (which loses all history)
 * and to renaming (which would leak backup files in the home directory).
 */
export function capLogFile(filePath: string, maxBytes: number = DEFAULT_MAX_BYTES): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size <= maxBytes) return;

    const fd = fs.openSync(filePath, 'r+');
    try {
      // Read the trailing keepBytes from the end of the file.
      const keep = Math.min(KEEP_LAST_BYTES, maxBytes);
      const start = stat.size - keep;
      const buffer = Buffer.alloc(keep);
      fs.readSync(fd, buffer, 0, keep, start);

      // Seek to the byte just after the first newline in the kept slice
      // so we don't leave a half-line at the start of the rotated file.
      let sliceStart = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0x0a /* \n */) {
          sliceStart = i + 1;
          break;
        }
      }

      const marker = `[${new Date().toISOString()}] [INFO] Log rotated (kept last ${(buffer.length - sliceStart).toString()} bytes)\n`;
      const markerBuf = Buffer.from(marker, 'utf8');
      const finalBuf = Buffer.concat([markerBuf, buffer.subarray(sliceStart)]);

      // Truncate and rewrite from offset 0.
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, finalBuf, 0, finalBuf.length, 0);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    // Log rotation must never crash the host process. Swallow and continue.
    try {
      console.error('[logRotation] capLogFile failed for', filePath, err);
    } catch {
      // Even console.error may be unavailable in some test environments.
    }
  }
}

/**
 * Sweep a log directory and delete all but the `maxFiles` most-recent
 * files matching `prefix` (e.g. `superagent-`).
 *
 * Returns the number of files deleted. Safe to call when the directory
 * does not exist (returns 0).
 */
export function rotateLogs(
  logsDir: string,
  maxFiles: number = 5,
  prefix: string = 'superagent-',
  suffix: string = '.log'
): number {
  let deleted = 0;
  try {
    if (!fs.existsSync(logsDir)) return 0;

    const entries = fs.readdirSync(logsDir);
    const candidates: Array<{ name: string; mtime: number }> = [];
    for (const name of entries) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      try {
        const stat = fs.statSync(path.join(logsDir, name));
        if (!stat.isFile()) continue;
        candidates.push({ name, mtime: stat.mtime.getTime() });
      } catch {
        // Skip unreadable entries; do not fail the whole sweep.
      }
    }

    // Newest first.
    candidates.sort((a, b) => b.mtime - a.mtime);
    for (const stale of candidates.slice(Math.max(0, maxFiles))) {
      try {
        fs.unlinkSync(path.join(logsDir, stale.name));
        deleted += 1;
      } catch {
        // Skip files we cannot delete; keep going.
      }
    }
  } catch (err) {
    try {
      console.error('[logRotation] rotateLogs failed for', logsDir, err);
    } catch {
      // ignore
    }
  }
  return deleted;
}

/**
 * Convenience entry point: cap the well-known t-line log files in the
 * user's home directory, and sweep any per-session log directory that
 * may exist. Call this once at backend / bridge init.
 */
export function rotateAllKnownLogs(): void {
  const home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || '';
  if (!home) return;

  // Single-file logs that the backend and bridge append to indefinitely.
  capLogFile(path.join(home, '.tline-backend.log'));
  capLogFile(path.join(home, '.tline-superagent.log'));

  // Per-session log directory (created on demand by future features).
  // Sweep with a generous cap so the directory stays bounded.
  rotateLogs(path.join(home, '.tline-logs'), 5);
  rotateLogs(path.join(home, '.tline-superagent-logs'), 5);
}
