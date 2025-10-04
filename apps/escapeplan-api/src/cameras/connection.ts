/**
 * Camera connection testing utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import type { TestCameraConnectionRequest, TestCameraConnectionResponse } from '@escapeplan/contracts';

const require = createRequire(import.meta.url);
const onvif = require('node-onvif');
const OnvifDevice = onvif.OnvifDevice;

const execAsync = promisify(exec);

/**
 * Get ONVIF stream URL by discovering the camera and fetching its stream URI
 * Uses hybrid approach: ONVIF for discovery, returns RTSP URL with injected credentials
 */
async function getOnvifStreamUrl(
  host: string,
  port: number,
  username: string | null | undefined,
  password: string | null | undefined
): Promise<{ url: string; resolution?: string; frameRate?: number }> {
  const device = new OnvifDevice({
    xaddr: `http://${host}:${port}/onvif/device_service`,
    user: username || undefined,
    pass: password || undefined
  });

  // Initialize device with 5-second timeout
  await device.init(5000);

  // Get stream URI (defaults to first profile with TCP transport)
  const streamUriResponse = await device.getStreamUri({
    protocol: 'RTSP'
  });

  if (!streamUriResponse || !streamUriResponse.uri) {
    throw new Error('No stream URI returned from ONVIF device');
  }

  let rtspUrl = streamUriResponse.uri;

  // Inject credentials into RTSP URL if not already present
  if (username && password) {
    // Parse the URL to inject credentials
    const urlMatch = rtspUrl.match(/^rtsp:\/\/(.+)$/);
    if (urlMatch) {
      const hostAndPath = urlMatch[1];
      // Check if credentials are already in the URL
      if (!hostAndPath.includes('@')) {
        rtspUrl = `rtsp://${username}:${password}@${hostAndPath}`;
      }
    }
  }

  // Extract resolution and frame rate from profile if available
  let resolution: string | undefined;
  let frameRate: number | undefined;

  if (device.current?.profiles && device.current.profiles.length > 0) {
    const profile = device.current.profiles[0];
    if (profile.video?.encoder?.resolution) {
      const { width, height } = profile.video.encoder.resolution;
      resolution = `${width}x${height}`;
    }
    if (profile.video?.encoder?.framerate_limit) {
      frameRate = profile.video.encoder.framerate_limit;
    }
  }

  return { url: rtspUrl, resolution, frameRate };
}

/**
 * Build camera URL from connection details
 * For ONVIF, returns a placeholder - actual URL will be discovered via ONVIF protocol
 */
function buildTestUrl(req: TestCameraConnectionRequest): string {
  const { protocol, host, port, username, password, streamPath } = req;

  let url = '';

  if (protocol === 'rtsp') {
    url = 'rtsp://';
    if (username && password) {
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${streamPath || '/'}`;
  } else if (protocol === 'mjpeg') {
    url = 'http://';
    if (username && password) {
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${streamPath || '/video.mjpg'}`;
  } else if (protocol === 'onvif') {
    // ONVIF uses discovery protocol, return placeholder
    // Actual URL will be obtained via getOnvifStreamUrl()
    url = `onvif://${host}:${port}`;
  }

  return url;
}

/**
 * Test ONVIF camera connection
 * Uses ONVIF protocol to discover stream URL, then validates with ffprobe
 */
async function testOnvifConnection(
  req: TestCameraConnectionRequest
): Promise<TestCameraConnectionResponse> {
  const { host, port, username, password } = req;

  try {
    // Step 1: Use ONVIF to discover the stream URL
    const onvifResult = await getOnvifStreamUrl(host, port, username, password);

    // Step 2: Validate the discovered RTSP stream with ffprobe
    const command = `ffprobe -v quiet -print_format json -show_streams -timeout 5000000 "${onvifResult.url}"`;

    try {
      const { stdout } = await execAsync(command, { timeout: 6000 });

      if (!stdout) {
        return {
          success: false,
          errorMessage: 'ONVIF discovery successful, but stream validation failed: No stream data received',
          diagnostics: {
            reachable: true,
            authValid: true,
            streamAvailable: false,
            resolution: onvifResult.resolution,
            frameRate: onvifResult.frameRate
          }
        };
      }

      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');

      if (!videoStream) {
        return {
          success: false,
          errorMessage: 'ONVIF discovery successful, but no video stream found',
          diagnostics: {
            reachable: true,
            authValid: true,
            streamAvailable: false,
            resolution: onvifResult.resolution,
            frameRate: onvifResult.frameRate
          }
        };
      }

      // Calculate FPS from r_frame_rate (e.g., "30/1" = 30fps)
      let fps = onvifResult.frameRate || 0;
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        fps = den > 0 ? Math.round(num / den) : fps;
      }

      return {
        success: true,
        diagnostics: {
          reachable: true,
          authValid: true,
          streamAvailable: true,
          resolution: onvifResult.resolution || `${videoStream.width}x${videoStream.height}`,
          frameRate: fps
        }
      };
    } catch (ffprobeError: any) {
      // ffprobe validation failed, but ONVIF discovery succeeded
      return {
        success: false,
        errorMessage: `ONVIF discovery successful, but stream validation failed: ${ffprobeError.message?.substring(0, 150)}`,
        diagnostics: {
          reachable: true,
          authValid: true,
          streamAvailable: false,
          resolution: onvifResult.resolution,
          frameRate: onvifResult.frameRate
        }
      };
    }
  } catch (error: any) {
    // ONVIF discovery failed
    const errorMessage = error.message || String(error);

    let diagnostics = {
      reachable: false,
      authValid: false,
      streamAvailable: false
    };

    // Parse ONVIF-specific errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
      diagnostics.reachable = false;
      return {
        success: false,
        errorMessage: 'Cannot reach ONVIF service - connection refused. Check IP address and port (typically 8000 for ONVIF).',
        diagnostics
      };
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      diagnostics.reachable = false;
      return {
        success: false,
        errorMessage: 'ONVIF connection timed out. Camera may be offline or port is incorrect.',
        diagnostics
      };
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication')) {
      diagnostics.reachable = true;
      diagnostics.authValid = false;
      return {
        success: false,
        errorMessage: 'ONVIF authentication failed. Check username and password.',
        diagnostics
      };
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      diagnostics.reachable = false;
      return {
        success: false,
        errorMessage: 'Cannot resolve hostname. Check IP address.',
        diagnostics
      };
    } else {
      // Generic ONVIF error
      diagnostics.reachable = true;
      return {
        success: false,
        errorMessage: `ONVIF error: ${errorMessage.substring(0, 150)}`,
        diagnostics
      };
    }
  }
}

/**
 * Test camera connection using ffprobe (for RTSP/MJPEG) or ONVIF protocol
 * Returns stream info if successful, error details if failed
 */
export async function testCameraConnection(
  req: TestCameraConnectionRequest
): Promise<TestCameraConnectionResponse> {
  // Handle ONVIF protocol separately
  if (req.protocol === 'onvif') {
    return testOnvifConnection(req);
  }

  // Check if ffprobe is available for non-ONVIF protocols
  try {
    await execAsync('which ffprobe');
  } catch (error) {
    return {
      success: false,
      errorMessage: 'ffprobe not installed. Install ffmpeg to enable connection testing.',
      diagnostics: {
        reachable: false,
        authValid: false,
        streamAvailable: false
      }
    };
  }

  const url = buildTestUrl(req);

  // Use ffprobe to test connection with 5-second timeout
  const command = `ffprobe -v quiet -print_format json -show_streams -timeout 5000000 "${url}"`;

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 6000 });

    if (!stdout) {
      return {
        success: false,
        errorMessage: 'No stream data received',
        diagnostics: {
          reachable: true,
          authValid: false,
          streamAvailable: false
        }
      };
    }

    const data = JSON.parse(stdout);

    if (!data.streams || data.streams.length === 0) {
      return {
        success: false,
        errorMessage: 'No video streams found',
        diagnostics: {
          reachable: true,
          authValid: true,
          streamAvailable: false
        }
      };
    }

    const videoStream = data.streams.find((s: any) => s.codec_type === 'video');

    if (!videoStream) {
      return {
        success: false,
        errorMessage: 'No video stream found (audio only?)',
        diagnostics: {
          reachable: true,
          authValid: true,
          streamAvailable: false
        }
      };
    }

    // Calculate FPS from r_frame_rate (e.g., "30/1" = 30fps)
    let fps = 0;
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
      fps = den > 0 ? Math.round(num / den) : 0;
    }

    return {
      success: true,
      diagnostics: {
        reachable: true,
        authValid: true,
        streamAvailable: true,
        resolution: `${videoStream.width}x${videoStream.height}`,
        frameRate: fps
      }
    };
  } catch (error: any) {
    // Parse error to determine failure reason
    const errorMessage = error.message || String(error);

    let diagnostics = {
      reachable: false,
      authValid: false,
      streamAvailable: false
    };

    if (errorMessage.includes('Connection refused') || errorMessage.includes('No route to host')) {
      diagnostics.reachable = false;
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Authentication')) {
      diagnostics.reachable = true;
      diagnostics.authValid = false;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      diagnostics.reachable = false;
    } else {
      // Some other error - assume reachable but stream unavailable
      diagnostics.reachable = true;
      diagnostics.authValid = true;
      diagnostics.streamAvailable = false;
    }

    return {
      success: false,
      errorMessage: errorMessage.substring(0, 200), // Truncate long errors
      diagnostics
    };
  }
}
