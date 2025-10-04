/**
 * Camera Discovery Utilities
 * Based on CAMERA_DISCOVERY_OPTIONS.md research
 * 
 * Phase 1 (MVP): Manual entry + validation
 * Phase 2: Network scan
 * Phase 3: ONVIF discovery
 */

import ffmpeg from 'fluent-ffmpeg';

// ============================================================================
// PHASE 1: Stream Validation (MVP - Use this now)
// ============================================================================

interface StreamInfo {
  valid: boolean;
  resolution?: string;
  fps?: number;
  codec?: string;
  hasAudio?: boolean;
  error?: string;
}

export async function validateCameraStream(
  url: string, 
  timeout: number = 10000
): Promise<StreamInfo> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(url, { timeout: timeout / 1000 }, (err, metadata) => {
      if (err) {
        return resolve({ 
          valid: false, 
          error: err.message 
        });
      }

      const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        return resolve({ 
          valid: false, 
          error: 'No video stream found' 
        });
      }

      resolve({
        valid: true,
        resolution: `${videoStream.width}x${videoStream.height}`,
        fps: eval(videoStream.r_frame_rate || '0'), // "30/1" -> 30
        codec: videoStream.codec_name,
        hasAudio: !!audioStream
      });
    });
  });
}

// ============================================================================
// PHASE 1: Test Connection with Brand Templates
// ============================================================================

export function buildRtspUrl(camera: {
  brand: string;
  host: string;
  port: number;
  username: string;
  password: string;
  streamPath: string;
}): string {
  const encodedUser = encodeURIComponent(camera.username);
  const encodedPass = encodeURIComponent(camera.password);
  
  return `rtsp://${encodedUser}:${encodedPass}@${camera.host}:${camera.port}${camera.streamPath}`;
}

// ============================================================================
// PHASE 2: Network Scan Discovery (Post-MVP)
// ============================================================================

/**
 * Scan network for cameras (requires evilscan package)
 * npm install evilscan
 */
export async function scanNetworkForCameras(
  subnet: string = '10.10.10.0/24'
): Promise<Array<{ ip: string; port: number }>> {
  // Note: Requires evilscan package
  const Evilscan = require('evilscan');
  
  return new Promise((resolve) => {
    const candidates: Array<{ ip: string; port: number }> = [];
    
    const options = {
      target: subnet,
      port: '554,80,8080,88', // Common camera ports
      status: 'O', // Open ports only
      banner: false
    };
    
    const scanner = new Evilscan(options);
    
    scanner.on('result', (data: any) => {
      if (data.status === 'open') {
        candidates.push({
          ip: data.ip,
          port: parseInt(data.port)
        });
      }
    });
    
    scanner.on('done', () => {
      resolve(candidates);
    });
    
    scanner.run();
  });
}

/**
 * Test common URL patterns for discovered IP
 */
export async function probeCameraPatterns(
  ip: string, 
  port: number
): Promise<{ brand: string; streamPath: string; valid: boolean } | null> {
  const patterns = [
    { brand: 'hikvision', path: '/Streaming/Channels/101' },
    { brand: 'dahua', path: '/cam/realmonitor?channel=1&subtype=0' },
    { brand: 'reolink', path: '/h264Preview_01_main' },
    { brand: 'axis', path: '/axis-media/media.amp' },
    { brand: 'foscam', path: '/videoMain' },
    { brand: 'tapo', path: '/stream1' },
    { brand: 'generic', path: '/onvif1' }
  ];
  
  for (const pattern of patterns) {
    const url = `rtsp://${ip}:${port}${pattern.path}`;
    
    try {
      const result = await validateCameraStream(url, 5000);
      if (result.valid) {
        return {
          brand: pattern.brand,
          streamPath: pattern.path,
          valid: true
        };
      }
    } catch (err) {
      continue;
    }
  }
  
  return null;
}

// ============================================================================
// PHASE 3: ONVIF Discovery (Post-MVP)
// ============================================================================

/**
 * Discover ONVIF cameras (requires node-onvif package)
 * npm install node-onvif
 */
export async function discoverOnvifCameras(): Promise<Array<{
  name: string;
  manufacturer: string;
  ip: string;
  streamUrl: string;
}>> {
  // Note: Requires node-onvif package
  const onvif = require('node-onvif');
  
  const devices = await onvif.startProbe();
  const cameras = [];
  
  for (const device of devices) {
    try {
      const cam = new onvif.OnvifDevice({
        xaddr: device.xaddr
      });
      
      await cam.init();
      
      const profiles = await cam.services.media.getProfiles();
      const streamUri = await cam.services.media.getStreamUri({
        protocol: 'RTSP',
        profileToken: profiles[0]?.$.token
      });
      
      cameras.push({
        name: device.name || 'ONVIF Camera',
        manufacturer: device.hardware || 'Unknown',
        ip: device.urn?.split(':')[4] || '',
        streamUrl: streamUri.uri
      });
    } catch (err) {
      console.error('Failed to probe ONVIF device:', err);
    }
  }
  
  return cameras;
}

// ============================================================================
// Brand Detection from Stream Path (for migration)
// ============================================================================

export function detectBrandFromStreamPath(path: string): string {
  if (path.includes('/Preview_') || path.includes('/h264Preview_')) return 'reolink';
  if (path.includes('/Streaming/Channels/')) return 'hikvision';
  if (path.includes('/cam/realmonitor')) return 'dahua';
  if (path.includes('/axis-media/')) return 'axis';
  if (path.includes('/stream')) return 'tapo';
  if (path.includes('/video')) return 'foscam';
  return 'generic';
}
