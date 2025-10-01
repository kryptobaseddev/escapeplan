import fs from 'node:fs/promises';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import type { MultipartFile } from '@fastify/multipart';

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
  data: MultipartFile,
  outputPath: string,
  mimeType: string
): Promise<ProcessedFile> {
  const buffer = await data.toBuffer();
  let metadata: Record<string, any> = {};
  let finalBuffer = buffer;

  if (mimeType.startsWith('image/')) {
    // Process image with sharp
    const result = await processImage(buffer, mimeType);
    finalBuffer = result.buffer;
    metadata = result.metadata;
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    // Extract metadata from audio/video
    // For now, write the file first, then extract metadata
    await fs.writeFile(outputPath, buffer);
    metadata = await extractMediaMetadata(outputPath);

    return {
      size: buffer.length,
      metadata
    };
  }

  // Write processed file
  await fs.writeFile(outputPath, finalBuffer);

  return {
    size: finalBuffer.length,
    metadata
  };
}

/**
 * Process image: compress and extract metadata
 */
async function processImage(buffer: Buffer, mimeType: string): Promise<{buffer: Buffer; metadata: Record<string, any>}> {
  const image = sharp(buffer);
  const info = await image.metadata();

  const metadata = {
    width: info.width,
    height: info.height,
    format: info.format,
    hasAlpha: info.hasAlpha,
    orientation: info.orientation
  };

  let processedImage = image;

  // Compress based on format
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
}

/**
 * Extract metadata from audio/video file using ffmpeg
 */
function extractMediaMetadata(filePath: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
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
