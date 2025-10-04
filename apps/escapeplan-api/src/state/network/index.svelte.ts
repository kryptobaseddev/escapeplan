/**
 * Network domain state management
 *
 * This module provides network profile and WiFi management using a class-based state pattern
 * inspired by Svelte 5 runes. All functions maintain existing behavior from the original
 * state.ts implementation.
 *
 * Key features:
 * - Network profile CRUD operations
 * - WiFi network scanning (nmcli integration)
 * - WiFi client connection management
 * - Signal strength monitoring
 * - Connection status tracking
 */

import { execSync } from 'node:child_process';
import { sqlite } from '../../db/client.js';
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
 * Database row type for network_profiles table
 */
type NetworkProfileRow = {
  id: string;
  name: string;
  ssid: string;
  password: string | null;
  description: string | null;
  band: string | null;
  channel: number | null;
  security: string | null;
  broadcast_enabled: number;
  status: string;
  status_message: string | null;
  details: string | null;
  last_updated: string;
};

/**
 * Prepared statement for fetching network profile
 */
const networkProfileStmt = sqlite.prepare(
  `SELECT id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated
   FROM network_profiles WHERE id = ? LIMIT 1`
);

/**
 * Maps a database NetworkProfileRow to a NetworkProfile domain object
 */
function mapNetworkProfile(row: NetworkProfileRow | undefined): NetworkProfile {
  if (!row) {
    return {
      id: 'primary',
      name: 'EscapePlan Control Network',
      ssid: 'escapeplan_net',
      broadcastEnabled: false,
      status: 'offline',
      lastUpdated: new Date().toISOString()
    };
  }
  return {
    id: row.id,
    name: row.name,
    ssid: row.ssid,
    password: row.password ?? undefined,
    description: row.description ?? undefined,
    band: row.band ?? undefined,
    channel: row.channel ?? undefined,
    security: row.security ?? undefined,
    broadcastEnabled: Boolean(row.broadcast_enabled),
    status: (row.status ?? 'offline') as NetworkHealth,
    statusMessage: row.status_message ?? undefined,
    details: row.details ?? undefined,
    lastUpdated: row.last_updated
  };
}

/**
 * Class-based state management for network domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class NetworkState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  profile: NetworkProfile | undefined = undefined;
  wifiNetworks: WiFiNetwork[] = [];
  clientStatus: WiFiClientStatus = { connected: false };
  lastScanTime: string | undefined = undefined;

  // Derived state (in Svelte this would be $derived)
  get isOnline(): boolean {
    return this.profile?.status === 'online';
  }

  get hasWiFiNetworks(): boolean {
    return this.wifiNetworks.length > 0;
  }

  get isWiFiConnected(): boolean {
    return this.clientStatus.connected === true;
  }

  /**
   * Gets the current network profile
   */
  getProfile(): NetworkProfile {
    const row = networkProfileStmt.get('primary') as NetworkProfileRow | undefined;
    this.profile = mapNetworkProfile(row);
    return this.profile;
  }

  /**
   * Updates the network profile with new configuration
   */
  updateProfile(input: UpdateNetworkProfileRequest): NetworkProfile {
    const existing = this.getProfile();
    const now = new Date().toISOString();
    const payload = {
      id: 'primary',
      name: input.name ?? existing.name,
      ssid: input.ssid ?? existing.ssid,
      password: input.password ?? existing.password ?? null,
      description: input.description ?? existing.description ?? null,
      band: input.band ?? existing.band ?? null,
      channel: input.channel ?? existing.channel ?? null,
      security: input.security ?? existing.security ?? null,
      broadcast_enabled: typeof input.broadcastEnabled === 'boolean' ? (input.broadcastEnabled ? 1 : 0) : existing.broadcastEnabled ? 1 : 0,
      status: input.status ?? existing.status,
      status_message: input.statusMessage ?? existing.statusMessage ?? null,
      details: input.details ?? existing.details ?? null,
      last_updated: now
    };

    sqlite
      .prepare(
        `INSERT INTO network_profiles (id, name, ssid, password, description, band, channel, security, broadcast_enabled, status, status_message, details, last_updated)
         VALUES (@id, @name, @ssid, @password, @description, @band, @channel, @security, @broadcast_enabled, @status, @status_message, @details, @last_updated)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           ssid = excluded.ssid,
           password = excluded.password,
           description = excluded.description,
           band = excluded.band,
           channel = excluded.channel,
           security = excluded.security,
           broadcast_enabled = excluded.broadcast_enabled,
           status = excluded.status,
           status_message = excluded.status_message,
           details = excluded.details,
           last_updated = excluded.last_updated`
      )
      .run(payload);

    return this.getProfile();
  }

  /**
   * Scans for available WiFi networks using nmcli
   */
  scanNetworks(): WiFiScanResponse {
    try {
      // Use nmcli to scan for WiFi networks
      const output = execSync('nmcli -t -f SSID,BSSID,SIGNAL,FREQ,SECURITY,CHAN,IN-USE dev wifi list', {
        encoding: 'utf8',
        timeout: 10000
      });

      const lines = output.trim().split('\n');
      const networks: WiFiNetwork[] = lines
        .map((line) => {
          const parts = line.split(':');
          if (parts.length < 7) return null;

          const [ssid, bssid, signalStr, freqStr, security, chanStr, inUseStr] = parts;

          // Skip empty SSIDs
          if (!ssid || ssid.trim() === '') return null;

          return {
            ssid: ssid.trim(),
            bssid: bssid.trim(),
            signal: parseInt(signalStr, 10) || 0,
            frequency: parseInt(freqStr, 10) || 0,
            security: security.trim() || 'Open',
            channel: parseInt(chanStr, 10) || 0,
            inUse: inUseStr === '*'
          };
        })
        .filter((n): n is WiFiNetwork => n !== null);

      // Remove duplicates (same SSID), keeping the strongest signal
      const uniqueNetworks = new Map<string, WiFiNetwork>();
      for (const network of networks) {
        const existing = uniqueNetworks.get(network.ssid);
        if (!existing || network.signal > existing.signal) {
          uniqueNetworks.set(network.ssid, network);
        }
      }

      const scannedAt = new Date().toISOString();
      this.wifiNetworks = Array.from(uniqueNetworks.values()).sort((a, b) => b.signal - a.signal);
      this.lastScanTime = scannedAt;

      return {
        networks: this.wifiNetworks,
        scannedAt
      };
    } catch (error) {
      // If nmcli fails, return empty scan (likely not on Linux or nmcli not installed)
      console.error('WiFi scan failed:', error);
      const scannedAt = new Date().toISOString();
      this.wifiNetworks = [];
      this.lastScanTime = scannedAt;
      return {
        networks: [],
        scannedAt
      };
    }
  }

  /**
   * Connects to a WiFi network as a client
   */
  connectToNetwork(request: WiFiClientConnectRequest): WiFiClientStatus {
    try {
      const { ssid, password } = request;

      // First, delete any existing connection with the same name
      try {
        execSync(`nmcli connection delete "${ssid}"`, { encoding: 'utf8', timeout: 5000 });
      } catch {
        // Ignore errors if connection doesn't exist
      }

      // Connect to the network
      if (password) {
        // WPA/WPA2 secured network
        execSync(`nmcli dev wifi connect "${ssid}" password "${password}"`, {
          encoding: 'utf8',
          timeout: 30000
        });
      } else {
        // Open network
        execSync(`nmcli dev wifi connect "${ssid}"`, {
          encoding: 'utf8',
          timeout: 30000
        });
      }

      // Get connection status
      this.clientStatus = this.getClientStatus();
      return this.clientStatus;
    } catch (error: any) {
      console.error('WiFi connection failed:', error);
      throw new Error(`Failed to connect to ${request.ssid}: ${error.message}`);
    }
  }

  /**
   * Gets the current WiFi client connection status
   */
  getClientStatus(): WiFiClientStatus {
    try {
      // Get active WiFi connection info
      const output = execSync('nmcli -t -f NAME,TYPE,DEVICE connection show --active', {
        encoding: 'utf8',
        timeout: 5000
      });

      const lines = output.trim().split('\n');
      const wifiConnection = lines.find((line) => line.includes('802-11-wireless') || line.includes('wireless'));

      if (!wifiConnection) {
        this.clientStatus = { connected: false };
        return this.clientStatus;
      }

      // Extract connection name (SSID)
      const parts = wifiConnection.split(':');
      const connectionName = parts[0];

      // Get signal strength and IP info
      try {
        const detailsOutput = execSync(`nmcli -t -f GENERAL.STATE,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS connection show "${connectionName}"`, {
          encoding: 'utf8',
          timeout: 5000
        });

        const details = detailsOutput.trim().split('\n');
        const ipAddress = details.find((d) => d.startsWith('IP4.ADDRESS'))?.split(':')[1]?.split('/')[0] || undefined;
        const gateway = details.find((d) => d.startsWith('IP4.GATEWAY'))?.split(':')[1] || undefined;
        const dnsRaw = details.filter((d) => d.startsWith('IP4.DNS')).map((d) => d.split(':')[1]);

        // Try to get signal strength
        let signal: number | undefined;
        try {
          const signalOutput = execSync('nmcli -t -f IN-USE,SIGNAL dev wifi list', {
            encoding: 'utf8',
            timeout: 5000
          });
          const activeNetwork = signalOutput.split('\n').find((line) => line.startsWith('*'));
          if (activeNetwork) {
            const signalStr = activeNetwork.split(':')[1];
            signal = parseInt(signalStr, 10) || undefined;
          }
        } catch {
          // Signal strength unavailable
        }

        this.clientStatus = {
          connected: true,
          ssid: connectionName,
          signal,
          ipAddress,
          gateway,
          dns: dnsRaw.length > 0 ? dnsRaw : undefined
        };
        return this.clientStatus;
      } catch {
        // Basic status without details
        this.clientStatus = {
          connected: true,
          ssid: connectionName
        };
        return this.clientStatus;
      }
    } catch (error) {
      console.error('Failed to get WiFi client status:', error);
      this.clientStatus = { connected: false };
      return this.clientStatus;
    }
  }

  /**
   * Disconnects from the current WiFi network
   */
  disconnectFromNetwork(): WiFiClientStatus {
    try {
      // Get active WiFi connection
      const status = this.getClientStatus();
      if (status.connected && status.ssid) {
        // Disconnect the active connection
        execSync(`nmcli connection down "${status.ssid}"`, {
          encoding: 'utf8',
          timeout: 5000
        });
      }
      this.clientStatus = { connected: false };
      return this.clientStatus;
    } catch (error) {
      console.error('WiFi disconnection failed:', error);
      return this.getClientStatus();
    }
  }
}

/**
 * Singleton instance of the network state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const networkState = new NetworkState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const getNetworkProfile = () => networkState.getProfile();
export const updateNetworkProfile = (input: UpdateNetworkProfileRequest) => networkState.updateProfile(input);
export const scanWiFiNetworks = () => networkState.scanNetworks();
export const connectToWiFi = (request: WiFiClientConnectRequest) => networkState.connectToNetwork(request);
export const getWiFiClientStatus = () => networkState.getClientStatus();
export const disconnectFromWiFi = () => networkState.disconnectFromNetwork();

/**
 * Re-export types for convenience
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
