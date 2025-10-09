import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface WiFiInterface {
  name: string;
  type: 'ap' | 'client';
  state: string;
  connection?: string;
}

/**
 * Detect all WiFi interfaces on the system
 * wlan0 is typically the AP, wlan1 is external dongle
 */
export async function detectWiFiInterfaces(): Promise<WiFiInterface[]> {
  try {
    // Use nmcli to list WiFi devices with detailed information
    const { stdout } = await execAsync('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status');

    const interfaces: WiFiInterface[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      const [device, type, state, connection] = line.split(':');

      // Only include WiFi devices
      if (type === 'wifi' && device) {
        // Determine if this is AP or client
        // wlan0 is typically the AP interface
        const interfaceType: 'ap' | 'client' = device === 'wlan0' ? 'ap' : 'client';

        interfaces.push({
          name: device,
          type: interfaceType,
          state: state || 'unavailable',
          connection: connection || undefined
        });
      }
    }

    return interfaces;
  } catch (error) {
    console.error('[WiFi] Failed to detect interfaces:', error);
    return [];
  }
}

/**
 * Check if external WiFi dongle (wlan1 or other client interface) is present
 */
export async function hasExternalWiFi(): Promise<boolean> {
  const interfaces = await detectWiFiInterfaces();
  return interfaces.some(iface => iface.type === 'client');
}

/**
 * Get the name of the external WiFi interface (e.g., wlan1)
 */
export async function getExternalWiFiInterface(): Promise<string | null> {
  const interfaces = await detectWiFiInterfaces();
  const clientInterface = interfaces.find(iface => iface.type === 'client');
  return clientInterface?.name || null;
}
