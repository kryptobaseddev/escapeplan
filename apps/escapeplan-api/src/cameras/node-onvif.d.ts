/**
 * TypeScript type definitions for node-onvif v0.1.7
 *
 * This library provides ONVIF protocol support for IP cameras
 * GitHub: https://github.com/futomi/node-onvif
 */

declare module 'node-onvif' {
  /**
   * ONVIF camera device instance
   */
  export class OnvifDevice {
    /**
     * Initialize the device with timeout
     * @param timeout_msec Timeout in milliseconds (default: 10000)
     * @returns Promise that resolves with device info
     */
    init(timeout_msec?: number): Promise<OnvifDeviceInformation>;

    /**
     * Get device information
     * @returns Promise that resolves with device information
     */
    getInformation(): Promise<OnvifDeviceInformation>;

    /**
     * Get stream URIs for the camera
     * @param params Stream URI parameters
     * @returns Promise that resolves with stream URI information
     */
    getStreamUri(params?: OnvifStreamUriParams): Promise<OnvifStreamUriResponse>;

    /**
     * Get device capabilities
     * @returns Promise that resolves with capabilities
     */
    getCapabilities(): Promise<OnvifCapabilities>;

    /**
     * Device address information
     */
    address: string;

    /**
     * Current status of the device
     */
    current: {
      services?: {
        media?: {
          version: string;
          namespace: string;
          xaddr: string;
        };
        ptz?: {
          version: string;
          namespace: string;
          xaddr: string;
        };
      };
      profiles?: OnvifProfile[];
    };
  }

  /**
   * ONVIF service configuration
   */
  export interface OnvifServiceConfig {
    /** Camera IP address or hostname */
    xaddr: string;
    /** Username for authentication */
    user?: string;
    /** Password for authentication */
    pass?: string;
  }

  /**
   * ONVIF device information
   */
  export interface OnvifDeviceInformation {
    Manufacturer?: string;
    Model?: string;
    FirmwareVersion?: string;
    SerialNumber?: string;
    HardwareId?: string;
  }

  /**
   * Media profile for the camera
   */
  export interface OnvifProfile {
    token: string;
    name: string;
    snapshot_uri?: string;
    stream?: {
      rtsp?: string;
      http?: string;
      udp?: string;
    };
    video?: {
      source?: {
        token: string;
        bounds: {
          width: number;
          height: number;
        };
      };
      encoder?: {
        token: string;
        encoding: string; // 'H264', 'MPEG4', 'JPEG'
        resolution: {
          width: number;
          height: number;
        };
        quality: number;
        framerate_limit: number;
        bitrate_limit: number;
        govlength: number;
      };
    };
    audio?: {
      source?: {
        token: string;
      };
      encoder?: {
        token: string;
        encoding: string;
        bitrate: number;
        sample_rate: number;
      };
    };
    ptz?: {
      token: string;
    };
  }

  /**
   * Parameters for getting stream URI
   */
  export interface OnvifStreamUriParams {
    /** Protocol to use */
    protocol?: 'UDP' | 'TCP' | 'RTSP' | 'HTTP';
    /** Profile token (defaults to first profile) */
    profileToken?: string;
  }

  /**
   * Stream URI response
   */
  export interface OnvifStreamUriResponse {
    /** Stream URI */
    uri: string;
    /** Whether URI is valid */
    invalid_after_connect: boolean;
    /** Whether URI is invalid after reboot */
    invalid_after_reboot: boolean;
    /** Timeout in seconds */
    timeout: string;
  }

  /**
   * Device capabilities
   */
  export interface OnvifCapabilities {
    Analytics?: {
      XAddr: string;
      RuleSupport: boolean;
      AnalyticsModuleSupport: boolean;
    };
    Device?: {
      XAddr: string;
      Network?: {
        IPFilter: boolean;
        ZeroConfiguration: boolean;
        IPVersion6: boolean;
        DynDNS: boolean;
      };
      System?: {
        DiscoveryResolve: boolean;
        DiscoveryBye: boolean;
        RemoteDiscovery: boolean;
        SystemBackup: boolean;
        SystemLogging: boolean;
        FirmwareUpgrade: boolean;
      };
    };
    Events?: {
      XAddr: string;
      WSSubscriptionPolicySupport: boolean;
      WSPullPointSupport: boolean;
      WSPausableSubscriptionManagerInterfaceSupport: boolean;
    };
    Imaging?: {
      XAddr: string;
    };
    Media?: {
      XAddr: string;
      StreamingCapabilities?: {
        RTPMulticast: boolean;
        RTP_TCP: boolean;
        RTP_RTSP_TCP: boolean;
      };
    };
    PTZ?: {
      XAddr: string;
    };
  }

  /**
   * Main export: Create ONVIF device instance
   */
  export default class Onvif {
    /**
     * Create a new ONVIF device instance
     * @param config Service configuration
     */
    constructor(config: OnvifServiceConfig);

    /**
     * Initialize the device
     * @param timeout_msec Timeout in milliseconds
     * @returns Promise that resolves with device info
     */
    init(timeout_msec?: number): Promise<OnvifDeviceInformation>;

    /**
     * Get device information
     */
    getInformation(): Promise<OnvifDeviceInformation>;

    /**
     * Get stream URI
     */
    getStreamUri(params?: OnvifStreamUriParams): Promise<OnvifStreamUriResponse>;

    /**
     * Get device capabilities
     */
    getCapabilities(): Promise<OnvifCapabilities>;

    /**
     * Device address
     */
    address: string;

    /**
     * Current device state
     */
    current: {
      services?: {
        media?: {
          version: string;
          namespace: string;
          xaddr: string;
        };
        ptz?: {
          version: string;
          namespace: string;
          xaddr: string;
        };
      };
      profiles?: OnvifProfile[];
    };
  }
}
