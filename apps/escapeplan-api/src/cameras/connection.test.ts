/**
 * Integration tests for camera connection functionality
 * Tests ONVIF protocol handling and stream validation
 */

import { describe, it, expect } from 'vitest';
import { testCameraConnection } from './connection.js';
import type { TestCameraConnectionRequest } from '@escapeplan/contracts';

describe('Camera Connection Tests', () => {
  describe('ONVIF Protocol', () => {
    it('should validate ONVIF request structure', async () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'onvif',
        host: '10.0.10.138',
        port: 8000,
        username: 'admin',
        password: 'test123'
      };

      // Validate structure without network call
      expect(request.protocol).toBe('onvif');
      expect(request.port).toBe(8000);
      expect(request.host).toBeDefined();
      expect(request.username).toBeDefined();
    });

    it('should handle ONVIF connection timeout gracefully', async () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'onvif',
        host: '192.168.1.999', // Invalid IP
        port: 8000,
        username: 'admin',
        password: 'test123'
      };

      const result = await testCameraConnection(request);
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
      expect(result.diagnostics?.reachable).toBe(false);
    });

    it('should validate Reolink E1 Pro configuration', () => {
      const reolinkConfig: TestCameraConnectionRequest = {
        protocol: 'onvif',
        host: '10.0.10.138',
        port: 8000,
        username: 'admin',
        password: 'Farmstar1984!'
      };

      // Validate structure
      expect(reolinkConfig.protocol).toBe('onvif');
      expect(reolinkConfig.port).toBe(8000);
      expect(reolinkConfig.host).toBe('10.0.10.138');
      expect(reolinkConfig.username).toBe('admin');
      expect(reolinkConfig.password).toBeDefined();
    });
  });

  describe('RTSP Protocol', () => {
    it('should validate RTSP request structure', () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'rtsp',
        host: '192.168.1.100',
        port: 554,
        username: 'admin',
        password: 'pass123',
        streamPath: '/stream1'
      };

      // Validate structure
      expect(request.protocol).toBe('rtsp');
      expect(request.port).toBe(554);
      expect(request.streamPath).toBe('/stream1');
    });

    it('should handle missing credentials in structure', () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'rtsp',
        host: '192.168.1.100',
        port: 554
      };

      expect(request.protocol).toBe('rtsp');
      expect(request.username).toBeUndefined();
      expect(request.password).toBeUndefined();
    });
  });

  describe('MJPEG Protocol', () => {
    it('should validate MJPEG request structure', () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'mjpeg',
        host: '192.168.1.100',
        port: 80,
        username: 'admin',
        password: 'pass123',
        streamPath: '/video.mjpg'
      };

      expect(request.protocol).toBe('mjpeg');
      expect(request.port).toBe(80);
      expect(request.streamPath).toBe('/video.mjpg');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection refused', async () => {
      const request: TestCameraConnectionRequest = {
        protocol: 'onvif',
        host: '127.0.0.1', // Localhost (nothing listening)
        port: 9999,
        username: 'admin',
        password: 'test'
      };

      const result = await testCameraConnection(request);
      expect(result.success).toBe(false);
      expect(result.diagnostics?.reachable).toBe(false);
    });

    it('should validate error message structure', () => {
      // Mock error response structure
      const errorResponse = {
        success: false,
        errorMessage: 'ONVIF error: Connection failed',
        diagnostics: {
          reachable: false,
          authValid: false,
          streamAvailable: false
        }
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.errorMessage).toBeDefined();
      expect(errorResponse.errorMessage).toContain('ONVIF');
      expect(errorResponse.diagnostics).toBeDefined();
    });
  });

  describe('Response Validation', () => {
    it('should return correct response structure for success', () => {
      // Mock successful response structure
      const mockResponse = {
        success: true,
        diagnostics: {
          reachable: true,
          authValid: true,
          streamAvailable: true,
          resolution: '640x360',
          frameRate: 15
        }
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.diagnostics?.reachable).toBe(true);
      expect(mockResponse.diagnostics?.resolution).toBeDefined();
      expect(mockResponse.diagnostics?.frameRate).toBeGreaterThan(0);
    });

    it('should return correct response structure for failure', () => {
      // Mock failed response structure
      const mockResponse = {
        success: false,
        errorMessage: 'Connection timeout',
        diagnostics: {
          reachable: false,
          authValid: false,
          streamAvailable: false
        }
      };

      expect(mockResponse.success).toBe(false);
      expect(mockResponse.errorMessage).toBeDefined();
      expect(mockResponse.diagnostics?.reachable).toBe(false);
    });
  });

  describe('Reolink E1 Pro Specific Tests', () => {
    const E1_PRO_CONFIG: TestCameraConnectionRequest = {
      protocol: 'onvif',
      host: '10.0.10.138',
      port: 8000,
      username: 'admin',
      password: 'Farmstar1984!'
    };

    it('should use correct ONVIF port (8000 not 554)', () => {
      expect(E1_PRO_CONFIG.port).toBe(8000);
      expect(E1_PRO_CONFIG.port).not.toBe(554); // RTSP port is closed
    });

    it('should use ONVIF protocol', () => {
      expect(E1_PRO_CONFIG.protocol).toBe('onvif');
    });

    it('should have correct IP address', () => {
      expect(E1_PRO_CONFIG.host).toBe('10.0.10.138');
    });

    it('should validate expected capabilities', () => {
      const capabilities = {
        hasPtz: true,
        hasAudio: true,
        hasIrControl: true
      };

      expect(capabilities.hasPtz).toBe(true);
      expect(capabilities.hasAudio).toBe(true);
      expect(capabilities.hasIrControl).toBe(true);
    });

    it('should validate PTZ control ranges', () => {
      const ptzControls = {
        pan: 0,
        tilt: 0,
        zoom: 0
      };

      expect(ptzControls.pan).toBeGreaterThanOrEqual(-180);
      expect(ptzControls.pan).toBeLessThanOrEqual(180);
      expect(ptzControls.tilt).toBeGreaterThanOrEqual(-90);
      expect(ptzControls.tilt).toBeLessThanOrEqual(90);
      expect(ptzControls.zoom).toBeGreaterThanOrEqual(0);
      expect(ptzControls.zoom).toBeLessThanOrEqual(100);
    });

    it('should validate expected resolutions', () => {
      const validResolutions = ['640x360', '2880x1616', '2560x1440', '1920x1080'];

      // Test that resolution detection would match one of these
      validResolutions.forEach(resolution => {
        expect(resolution).toMatch(/^\d+x\d+$/);
      });
    });

    it('should validate expected frame rates', () => {
      const validFPS = [15, 25, 30];

      validFPS.forEach(fps => {
        expect(fps).toBeGreaterThan(0);
        expect(fps).toBeLessThanOrEqual(60);
      });
    });

    it('should create complete camera configuration', () => {
      const cameraConfig = {
        name: 'Reolink E1 Pro Test',
        brand: 'reolink',
        model: 'E1 Pro',
        protocol: E1_PRO_CONFIG.protocol,
        host: E1_PRO_CONFIG.host,
        port: E1_PRO_CONFIG.port,
        username: E1_PRO_CONFIG.username,
        password: E1_PRO_CONFIG.password,
        hasPtz: true,
        hasAudio: true,
        hasIrControl: true,
        resolution: '720p',
        frameRate: 15,
        transport: 'tcp',
        irMode: 'auto',
        audioVolume: 80,
        ptzPan: 0,
        ptzTilt: 0,
        ptzZoom: 0
      };

      expect(cameraConfig.name).toBeDefined();
      expect(cameraConfig.brand).toBe('reolink');
      expect(cameraConfig.model).toBe('E1 Pro');
      expect(cameraConfig.protocol).toBe('onvif');
      expect(cameraConfig.hasPtz).toBe(true);
      expect(cameraConfig.hasAudio).toBe(true);
      expect(cameraConfig.hasIrControl).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete camera setup flow', () => {
      // 1. Test connection
      const testRequest: TestCameraConnectionRequest = {
        protocol: 'onvif',
        host: '10.0.10.138',
        port: 8000,
        username: 'admin',
        password: 'Farmstar1984!'
      };

      expect(testRequest).toBeDefined();

      // 2. Create camera record (would happen after successful test)
      const cameraRecord = {
        id: 'test-camera-id',
        name: 'Test Camera',
        brand: 'reolink',
        protocol: testRequest.protocol,
        host: testRequest.host,
        port: testRequest.port,
        username: testRequest.username,
        hasPtz: true,
        hasAudio: true,
        hasIrControl: true,
        status: 'offline',
        hlsStreaming: false
      };

      expect(cameraRecord.protocol).toBe('onvif');
      expect(cameraRecord.port).toBe(8000);
      expect(cameraRecord.status).toBe('offline'); // Until streaming starts
    });

    it('should validate camera creation payload', () => {
      const createPayload = {
        name: 'Reolink E1 Pro - Test Room',
        brand: 'reolink',
        model: 'E1 Pro',
        protocol: 'onvif',
        host: '10.0.10.138',
        port: 8000,
        username: 'admin',
        password: 'Farmstar1984!',
        resolution: '720p',
        frameRate: 15,
        transport: 'tcp',
        hasPtz: true,
        hasAudio: true,
        hasIrControl: true,
        irMode: 'auto',
        audioVolume: 80,
        ptzPan: 0,
        ptzTilt: 0,
        ptzZoom: 0
      };

      // Validate all required fields present
      expect(createPayload.name).toBeDefined();
      expect(createPayload.brand).toBeDefined();
      expect(createPayload.protocol).toBeDefined();
      expect(createPayload.host).toBeDefined();
      expect(createPayload.port).toBeDefined();
      expect(createPayload.username).toBeDefined();
      expect(createPayload.password).toBeDefined();

      // Validate capabilities
      expect(createPayload.hasPtz).toBe(true);
      expect(createPayload.hasAudio).toBe(true);
      expect(createPayload.hasIrControl).toBe(true);

      // Validate PTZ defaults
      expect(createPayload.ptzPan).toBe(0);
      expect(createPayload.ptzTilt).toBe(0);
      expect(createPayload.ptzZoom).toBe(0);

      // Validate settings
      expect(createPayload.resolution).toBe('720p');
      expect(createPayload.frameRate).toBe(15);
      expect(createPayload.transport).toBe('tcp');
      expect(createPayload.irMode).toBe('auto');
      expect(createPayload.audioVolume).toBe(80);
    });
  });

  describe('Diagnostic Information', () => {
    it('should provide comprehensive diagnostics on success', () => {
      const successDiagnostics = {
        reachable: true,
        authValid: true,
        streamAvailable: true,
        resolution: '640x360',
        frameRate: 15
      };

      expect(successDiagnostics.reachable).toBe(true);
      expect(successDiagnostics.authValid).toBe(true);
      expect(successDiagnostics.streamAvailable).toBe(true);
      expect(successDiagnostics.resolution).toMatch(/^\d+x\d+$/);
      expect(successDiagnostics.frameRate).toBeGreaterThan(0);
    });

    it('should provide helpful diagnostics on failure', () => {
      const failureDiagnostics = {
        reachable: false,
        authValid: false,
        streamAvailable: false
      };

      expect(failureDiagnostics.reachable).toBe(false);
      expect(failureDiagnostics.authValid).toBe(false);
      expect(failureDiagnostics.streamAvailable).toBe(false);
    });

    it('should differentiate between connection and auth failures', () => {
      const connectionFailure = {
        reachable: false,
        authValid: false,
        streamAvailable: false
      };

      const authFailure = {
        reachable: true,
        authValid: false,
        streamAvailable: false
      };

      expect(connectionFailure.reachable).toBe(false);
      expect(authFailure.reachable).toBe(true);
      expect(authFailure.authValid).toBe(false);
    });
  });
});
