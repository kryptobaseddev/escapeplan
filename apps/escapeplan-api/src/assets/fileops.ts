import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Atomically write buffer to file using temp-file-then-rename pattern.
 * This prevents partial file writes and ensures filesystem consistency.
 *
 * Process:
 * 1. Write to temporary file in same directory (required for atomic rename)
 * 2. Perform atomic rename to final destination
 * 3. Cleanup temp file on any error
 *
 * @param buffer - Data to write
 * @param finalPath - Destination file path
 * @returns Size of written file in bytes
 * @throws Error if write or rename fails (with automatic temp file cleanup)
 */
export async function atomicWriteFile(
  buffer: Buffer,
  finalPath: string
): Promise<number> {
  // Generate unique temp filename in same directory (required for atomic rename)
  // Temp file must be on same filesystem for rename() to be atomic
  const dir = path.dirname(finalPath);
  const tempFilename = `.tmp-${crypto.randomUUID()}-${path.basename(finalPath)}`;
  const tempPath = path.join(dir, tempFilename);

  try {
    // Step 1: Write to temp file
    await fs.writeFile(tempPath, buffer);

    // Step 2: Atomic rename (OS-level atomic operation)
    // This ensures either old file exists or new file exists, never partial
    // On POSIX systems (Linux/macOS), rename() is atomic when on same filesystem
    await fs.rename(tempPath, finalPath);

    return buffer.length;
  } catch (error) {
    // Cleanup temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors (file may not exist)
    }
    throw error;
  }
}

/**
 * Check if sufficient disk space available before writing file.
 * Uses fs.statfs() to get filesystem statistics.
 *
 * @param dirPath - Directory path to check
 * @param requiredBytes - Bytes needed
 * @returns Object with available flag and free bytes count
 */
export async function checkDiskSpace(
  dirPath: string,
  requiredBytes: number
): Promise<{ available: boolean; freeBytes: number }> {
  try {
    const stats = await fs.statfs(dirPath);
    // Available blocks * block size = available bytes
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    return {
      available: freeBytes > requiredBytes,
      freeBytes
    };
  } catch (error) {
    // If statfs fails, assume space is available (don't block uploads)
    // This ensures graceful degradation on systems where statfs is unavailable
    return { available: true, freeBytes: 0 };
  }
}
