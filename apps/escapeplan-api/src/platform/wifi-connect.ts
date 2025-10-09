import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { WiFiClientConnectRequest, WiFiClientStatus } from '@escapeplan/contracts';
import { getExternalWiFiInterface } from './wifi-detect.js';

const execAsync = promisify(exec);

/**
 * Connect to external WiFi network via client interface (wlan1)
 */
export async function connectToWiFi(request: WiFiClientConnectRequest): Promise<WiFiClientStatus> {
  const ifname = await getExternalWiFiInterface();
  if (!ifname) {
    throw new Error('No external WiFi interface available');
  }

  const { ssid, password } = request;

  try {
    // Build nmcli command
    let command = `nmcli device wifi connect "${ssid}"`;

    if (password) {
      command += ` password "${password}"`;
    }

    command += ` ifname ${ifname}`;

    // Connect to the network
    const { stdout } = await execAsync(command, { timeout: 30000 });

    console.log(`[WiFi] Connected to ${ssid}:`, stdout);

    // Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enable internet sharing after successful connection
    try {
      await enableInternetSharing(ifname);
      console.log('[WiFi] Internet sharing enabled');
    } catch (error) {
      console.warn('[WiFi] Failed to enable internet sharing:', error);
      // Don't fail the connection if internet sharing fails
    }

    // Get and return the connection status
    return await getWiFiStatus();
  } catch (error) {
    console.error(`[WiFi] Failed to connect to ${ssid}:`, error);
    throw new Error(`Failed to connect to WiFi: ${(error as Error).message}`);
  }
}

/**
 * Disconnect from current WiFi network
 */
export async function disconnectWiFi(): Promise<void> {
  const ifname = await getExternalWiFiInterface();
  if (!ifname) {
    throw new Error('No external WiFi interface available');
  }

  try {
    // Get the active connection on this interface
    const { stdout } = await execAsync(
      `nmcli -t -f NAME connection show --active | head -1`,
      { timeout: 5000 }
    );

    const connectionName = stdout.trim();

    if (connectionName) {
      // Disconnect the active connection
      await execAsync(`nmcli connection down "${connectionName}"`, { timeout: 10000 });
      console.log(`[WiFi] Disconnected from ${connectionName}`);
    } else {
      console.log('[WiFi] No active WiFi connection to disconnect');
    }

    // Disable internet sharing
    try {
      await disableInternetSharing();
      console.log('[WiFi] Internet sharing disabled');
    } catch (error) {
      console.warn('[WiFi] Failed to disable internet sharing:', error);
    }
  } catch (error) {
    console.error('[WiFi] Disconnect failed:', error);
    throw new Error(`Failed to disconnect from WiFi: ${(error as Error).message}`);
  }
}

/**
 * Get current WiFi connection status
 */
export async function getWiFiStatus(): Promise<WiFiClientStatus> {
  const ifname = await getExternalWiFiInterface();
  if (!ifname) {
    return { connected: false };
  }

  try {
    // Get active connection details
    const { stdout: connectionInfo } = await execAsync(
      `nmcli -t -f GENERAL.CONNECTION,GENERAL.STATE,IP4.ADDRESS,IP4.GATEWAY,IP4.DNS device show ${ifname}`,
      { timeout: 5000 }
    );

    const lines = connectionInfo.trim().split('\n');
    const data: Record<string, string> = {};

    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        data[key.trim()] = value.trim();
      }
    }

    const state = data['GENERAL.STATE'];
    const connected = state?.includes('connected') || false;

    if (!connected) {
      return { connected: false };
    }

    // Get SSID from active connection
    let ssid: string | undefined;
    try {
      const connectionName = data['GENERAL.CONNECTION'];
      if (connectionName) {
        const { stdout: ssidOut } = await execAsync(
          `nmcli -t -f 802-11-wireless.ssid connection show "${connectionName}"`,
          { timeout: 5000 }
        );
        ssid = ssidOut.split(':')[1]?.trim();
      }
    } catch (error) {
      console.warn('[WiFi] Failed to get SSID:', error);
    }

    // Get signal strength
    let signal: number | undefined;
    try {
      const { stdout: signalOut } = await execAsync(
        `nmcli -t -f GENERAL.WIFI-PROPERTIES.SIGNAL device show ${ifname}`,
        { timeout: 5000 }
      );
      const signalStr = signalOut.split(':')[1]?.trim();
      if (signalStr) {
        signal = parseInt(signalStr, 10);
      }
    } catch (error) {
      console.warn('[WiFi] Failed to get signal strength:', error);
    }

    // Parse IP address (format: "192.168.1.100/24")
    const ipWithCidr = data['IP4.ADDRESS'];
    const ipAddress = ipWithCidr?.split('/')[0];

    // Parse gateway
    const gateway = data['IP4.GATEWAY'];

    // Parse DNS servers (may be multiple, comma-separated)
    const dnsStr = data['IP4.DNS'];
    const dns = dnsStr ? dnsStr.split(',').map(d => d.trim()) : undefined;

    return {
      connected: true,
      ssid,
      signal,
      ipAddress,
      gateway,
      dns
    };
  } catch (error) {
    console.error('[WiFi] Failed to get status:', error);
    return { connected: false };
  }
}

/**
 * Enable internet sharing from external WiFi (wlan1) to AP clients (wlan0)
 * Requires iptables NAT configuration and IP forwarding
 */
async function enableInternetSharing(externalInterface: string): Promise<void> {
  try {
    // Enable IP forwarding
    await execAsync('sudo sysctl -w net.ipv4.ip_forward=1', { timeout: 5000 });

    // Add iptables NAT rule for internet sharing
    // MASQUERADE allows outgoing packets from wlan0 to appear as coming from wlan1's IP
    await execAsync(
      `sudo iptables -t nat -C POSTROUTING -o ${externalInterface} -j MASQUERADE 2>/dev/null || sudo iptables -t nat -A POSTROUTING -o ${externalInterface} -j MASQUERADE`,
      { timeout: 5000 }
    );

    // Allow forwarding from wlan0 to external interface
    await execAsync(
      `sudo iptables -C FORWARD -i wlan0 -o ${externalInterface} -j ACCEPT 2>/dev/null || sudo iptables -A FORWARD -i wlan0 -o ${externalInterface} -j ACCEPT`,
      { timeout: 5000 }
    );

    // Allow return traffic
    await execAsync(
      `sudo iptables -C FORWARD -i ${externalInterface} -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || sudo iptables -A FORWARD -i ${externalInterface} -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT`,
      { timeout: 5000 }
    );

    console.log(`[WiFi] Internet sharing enabled: wlan0 → ${externalInterface}`);
  } catch (error) {
    console.error('[WiFi] Failed to enable internet sharing:', error);
    throw new Error(`Failed to enable internet sharing: ${(error as Error).message}`);
  }
}

/**
 * Disable internet sharing by removing iptables rules
 */
async function disableInternetSharing(): Promise<void> {
  try {
    const ifname = await getExternalWiFiInterface();
    if (!ifname) return;

    // Remove iptables rules
    await execAsync(
      `sudo iptables -t nat -D POSTROUTING -o ${ifname} -j MASQUERADE 2>/dev/null || true`,
      { timeout: 5000 }
    );

    await execAsync(
      `sudo iptables -D FORWARD -i wlan0 -o ${ifname} -j ACCEPT 2>/dev/null || true`,
      { timeout: 5000 }
    );

    await execAsync(
      `sudo iptables -D FORWARD -i ${ifname} -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true`,
      { timeout: 5000 }
    );

    console.log('[WiFi] Internet sharing disabled');
  } catch (error) {
    console.error('[WiFi] Failed to disable internet sharing:', error);
    // Don't throw - this is cleanup
  }
}
