import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { atomicWriteFile } from './fileops.js';

const execAsync = promisify(exec);

let ffprobeAvailable: boolean | null = null;

/**
 * Check if ffprobe is available on the system.
 * Cached after first check.
 */
export async function checkFfprobeAvailable(): Promise<boolean> {
  if (ffprobeAvailable !== null) return ffprobeAvailable;

  try {
    await execAsync('which ffprobe');
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }

  return ffprobeAvailable;
}

export interface ProcessedFile {
  size: number;
  metadata: Record<string, any>;
}

/**
 * Process uploaded file based on MIME type
 * - Images: compress and extract metadata
 * - Audio/Video: extract metadata only
 */
export async function processFile(
  buffer: Buffer,
  outputPath: string,
  mimeType: string
): Promise<ProcessedFile> {
  let metadata: Record<string, any> = {};
  let finalBuffer = buffer;

  if (mimeType.startsWith('image/')) {
    // Process image with sharp
    const result = await processImage(buffer, mimeType);
    finalBuffer = result.buffer;
    metadata = result.metadata;
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    // Extract metadata from audio/video
    // Write file atomically first, then extract metadata
    await atomicWriteFile(buffer, outputPath);
    metadata = await extractMediaMetadata(outputPath);

    return {
      size: buffer.length,
      metadata
    };
  }

  // Write processed file atomically
  await atomicWriteFile(finalBuffer, outputPath);

  return {
    size: finalBuffer.length,
    metadata
  };
}

/**
 * Process image: compress and extract metadata
 * Throws client-error-specific exceptions for corrupted/invalid images
 */
async function processImage(buffer: Buffer, mimeType: string): Promise<{buffer: Buffer; metadata: Record<string, any>}> {
  let image;
  let info;

  try {
    image = sharp(buffer);
    info = await image.metadata();
  } catch (error) {
    // Differentiate between client errors (bad file) and server errors
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('Input buffer') ||
        errorMessage.includes('unsupported image format') ||
        errorMessage.includes('corrupt') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('VipsJpeg') ||
        errorMessage.includes('VipsPng') ||
        errorMessage.includes('premature end')) {
      // This is a client error - bad file format
      throw new Error(`Invalid or corrupted image file: ${errorMessage}`);
    }

    // Server error - re-throw as-is
    throw error;
  }

  const metadata = {
    width: info.width,
    height: info.height,
    format: info.format,
    hasAlpha: info.hasAlpha,
    orientation: info.orientation
  };

  let processedImage = image;

  // Compress based on format
  try {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      processedImage = image.jpeg({
        quality: 85,
        mozjpeg: true // Better compression
      });
    } else if (mimeType === 'image/png') {
      processedImage = image.png({
        compressionLevel: 8,
        adaptiveFiltering: true
      });
    } else if (mimeType === 'image/webp') {
      processedImage = image.webp({
        quality: 85
      });
    }

    const finalBuffer = await processedImage.toBuffer();

    return {
      buffer: finalBuffer,
      metadata
    };
  } catch (error) {
    // Catch any processing errors
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('Input buffer') ||
        errorMessage.includes('unsupported') ||
        errorMessage.includes('corrupt') ||
        errorMessage.includes('invalid')) {
      throw new Error(`Image processing failed: ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Extract metadata from audio/video file using ffmpeg
 * Rejects if ffprobe fails or is not available (validation failure)
 */
async function extractMediaMetadata(filePath: string): Promise<Record<string, any>> {
  // Check if ffprobe is available
  const available = await checkFfprobeAvailable();
  if (!available) {
    throw new Error('FFprobe is not installed. Cannot process video/audio files.');
  }

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('ffprobe failed for media file:', err.message);
        reject(new Error(`Media file validation failed: ${err.message}. FFprobe is required for video/audio processing.`));
        return;
      }

      const format = metadata.format || {};
      const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');

      const result: Record<string, any> = {
        duration: format.duration,
        bitrate: format.bit_rate,
        format: format.format_name,
        size: format.size
      };

      if (videoStream) {
        result.video = {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: eval(videoStream.r_frame_rate || '0'), // e.g., "30/1" -> 30
          bitrate: videoStream.bit_rate
        };
      }

      if (audioStream) {
        result.audio = {
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
          bitrate: audioStream.bit_rate
        };
      }

      resolve(result);
    });
  });
}

/**
 * Format file size to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
