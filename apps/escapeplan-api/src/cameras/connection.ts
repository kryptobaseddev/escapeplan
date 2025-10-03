/**
 * Camera connection testing utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { TestCameraConnectionRequest, TestCameraConnectionResponse } from '@escapeplan/contracts';

const execAsync = promisify(exec);

/**
 * Build camera URL from connection details
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
    url = 'rtsp://';
    if (username && password) {
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${streamPath || '/onvif1'}`;
  }

  return url;
}

/**
 * Test camera connection using ffprobe
 * Returns stream info if successful, error details if failed
 */
export async function testCameraConnection(
  req: TestCameraConnectionRequest
): Promise<TestCameraConnectionResponse> {
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
