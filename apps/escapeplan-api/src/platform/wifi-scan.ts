import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { WiFiNetwork } from '@escapeplan/contracts';
import { getExternalWiFiInterface } from './wifi-detect.js';

const execAsync = promisify(exec);

/**
 * Parse nmcli WiFi scan output and convert to WiFiNetwork objects
 */
function parseWiFiList(output: string): WiFiNetwork[] {
  const networks: WiFiNetwork[] = [];
  const lines = output.trim().split('\n');
  const seenSSIDs = new Map<string, WiFiNetwork>();

  for (const line of lines) {
    if (!line.trim()) continue;

    // nmcli output format (with -t -f): IN-USE:BSSID:SSID:MODE:CHAN:RATE:SIGNAL:SECURITY
    // BSSID is a MAC address with colons (e.g., 70:3A:CB:12:34:56)
    // So we need to carefully parse: IN-USE:XX:XX:XX:XX:XX:XX:SSID:MODE:CHAN:RATE:SIGNAL:SECURITY
    const parts = line.split(':');

    // Need at least: IN-USE + 6 BSSID parts + SSID + MODE + CHAN + RATE + SIGNAL = 13 parts minimum
    if (parts.length < 13) continue;

    const inUse = parts[0];
    // BSSID is parts 1-6 (6 hex octets)
    const bssid = parts.slice(1, 7).join(':');
    const ssid = parts[7];
    const mode = parts[8];
    const channel = parts[9];
    const rate = parts[10];
    const signal = parts[11];
    // Security may contain colons, so join the rest
    const security = parts.slice(12).join(':') || 'Open';

    // Skip if no SSID (hidden networks)
    if (!ssid || ssid.trim() === '') continue;

    // Parse signal strength (should be 0-100)
    const signalNum = parseInt(signal, 10);
    const signalStrength = isNaN(signalNum) ? 0 : Math.min(100, Math.max(0, signalNum));

    // Parse channel
    const channelNum = parseInt(channel, 10);
    const channelNumber = isNaN(channelNum) ? 0 : channelNum;

    // Calculate frequency based on channel
    let frequency = 2412; // Default to 2.4GHz channel 1
    if (channelNumber >= 1 && channelNumber <= 14) {
      frequency = 2407 + (channelNumber * 5);
    } else if (channelNumber >= 36 && channelNumber <= 165) {
      frequency = 5000 + (channelNumber * 5);
    }

    // Normalize security string
    let securityType = security.trim();
    if (!securityType || securityType === '--') {
      securityType = 'Open';
    }

    const network: WiFiNetwork = {
      ssid: ssid.trim(),
      bssid,
      signal: signalStrength,
      frequency,
      security: securityType,
      channel: channelNumber,
      inUse: inUse === '*'
    };

    // Deduplicate: keep the strongest signal for each SSID
    const existing = seenSSIDs.get(network.ssid);
    if (!existing || network.signal > existing.signal) {
      seenSSIDs.set(network.ssid, network);
    }
  }

  // Convert map to array and sort by signal strength (strongest first)
  return Array.from(seenSSIDs.values()).sort((a, b) => b.signal - a.signal);
}

/**
 * Scan for available WiFi networks on the external interface
 * ONLY call this if hasExternalWiFi() returns true
 */
export async function scanWiFiNetworks(): Promise<WiFiNetwork[]> {
  try {
    const ifname = await getExternalWiFiInterface();
    if (!ifname) {
      throw new Error('No external WiFi interface available');
    }

    // Trigger a fresh scan first
    try {
      await execAsync(`nmcli device wifi rescan ifname ${ifname}`, { timeout: 10000 });
      // Wait a moment for scan to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      // Scan might fail if already in progress, that's okay
      console.warn('[WiFi] Scan trigger warning (continuing):', (error as Error).message);
    }

    // Get the list of networks
    const { stdout } = await execAsync(
      `nmcli -t -f IN-USE,BSSID,SSID,MODE,CHAN,RATE,SIGNAL,SECURITY device wifi list ifname ${ifname}`,
      { timeout: 10000 }
    );

    return parseWiFiList(stdout);
  } catch (error) {
    console.error('[WiFi] Scan failed:', error);
    throw new Error(`WiFi scan failed: ${(error as Error).message}`);
  }
}
