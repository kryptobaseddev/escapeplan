/**
 * Network state management types
 *
 * This module defines types for network operations including:
 * - WiFi network configuration and scanning
 * - Network profile management
 * - Client connection status
 * - Network health monitoring
 */

import type {
  NetworkProfile,
  NetworkHealth,
  UpdateNetworkProfileRequest,
  WiFiNetwork,
  WiFiScanResponse,
  WiFiClientConnectRequest,
  WiFiClientStatus
} from '@escapeplan/contracts';

/**
 * Re-export contract types for convenience
 */
export type {
  NetworkProfile,
  NetworkHealth,
  UpdateNetworkProfileRequest,
  WiFiNetwork,
  WiFiScanResponse,
  WiFiClientConnectRequest,
  WiFiClientStatus
};

/**
 * Network operation result types
 */
export interface NetworkProfileResult {
  profile: NetworkProfile;
}

export interface WiFiScanResult {
  networks: WiFiNetwork[];
  scannedAt: string;
}

export interface WiFiConnectionResult {
  status: WiFiClientStatus;
  connectedAt?: string;
}

/**
 * Network configuration stored in database
 */
export interface NetworkConfigRow {
  id: string;
  ssid: string;
  channel: number;
  hidden: boolean;
  max_clients: number;
  country_code: string;
  updated_at: string;
}

/**
 * WiFi client state
 */
export interface WiFiClientState {
  connected: boolean;
  ssid?: string;
  signalStrength?: number;
  ipAddress?: string;
  lastConnected?: string;
}

/**
 * Network health check result
 */
export interface NetworkHealthCheck {
  status: NetworkHealth;
  checkedAt: string;
  details: {
    accessPointActive: boolean;
    dhcpActive: boolean;
    dnsActive: boolean;
    clientCount: number;
    errors: string[];
  };
}

/**
 * Network operation errors
 */
export enum NetworkErrorCode {
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  SCAN_FAILED = 'SCAN_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISCONNECTION_FAILED = 'DISCONNECTION_FAILED',
  INVALID_PROFILE = 'INVALID_PROFILE',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
}

export interface NetworkError {
  code: NetworkErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
