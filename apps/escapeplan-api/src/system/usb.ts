/**
 * USB Device Detection & Management
 *
 * Detects USB drives for backup storage
 * Monitors /proc/mounts and /dev/disk/by-id for USB devices
 * Auto-mounts to /mnt/escapeplan-backup/
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { db } from '../db/client.js';
import { usbDevices } from '@escapeplan/contracts';
import { eq, desc } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import type { USBDeviceResponse } from '@escapeplan/contracts';

const execAsync = promisify(exec);
const ulid = monotonicFactory();

// ============================================================================
// USB DETECTION
// ============================================================================

interface MountInfo {
  device: string;
  mountPoint: string;
  fsType: string;
  options: string;
}

/**
 * Parse /proc/mounts to find mounted USB devices
 */
async function getMountedDevices(): Promise<MountInfo[]> {
  try {
    const mounts = await fs.readFile('/proc/mounts', 'utf-8');
    const lines = mounts.split('\n').filter((line) => line.trim());

    return lines
      .filter((line) => {
        // Filter for USB devices (typically /dev/sd* or /dev/mmcblk*)
        return line.startsWith('/dev/sd') || line.startsWith('/dev/mmcblk');
      })
      .map((line) => {
        const parts = line.split(/\s+/);
        return {
          device: parts[0],
          mountPoint: parts[1],
          fsType: parts[2],
          options: parts[3]
        };
      });
  } catch (error) {
    console.error('Failed to read /proc/mounts:', error);
    return [];
  }
}

/**
 * Get disk space for a device using df command
 */
async function getDiskSpace(device: string): Promise<{
  totalGb: number;
  availableGb: number;
} | null> {
  try {
    const { stdout } = await execAsync(`df -BG ${device} | tail -1`);
    const parts = stdout.trim().split(/\s+/);

    // df output: Filesystem 1G-blocks Used Available Use% Mounted on
    const totalGb = parseInt(parts[1].replace('G', ''), 10);
    const availableGb = parseInt(parts[3].replace('G', ''), 10);

    return { totalGb, availableGb };
  } catch (error) {
    return null;
  }
}

/**
 * Get device label using lsblk
 */
async function getDeviceLabel(device: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`lsblk -no LABEL ${device}`);
    const label = stdout.trim();
    return label || null;
  } catch (error) {
    return null;
  }
}

/**
 * Scan for USB devices and update database
 */
export async function scanUSBDevices(): Promise<USBDeviceResponse[]> {
  const mountedDevices = await getMountedDevices();
  const detectedDevices: USBDeviceResponse[] = [];

  for (const mount of mountedDevices) {
    const space = await getDiskSpace(mount.device);
    const label = await getDeviceLabel(mount.device);

    const deviceId = ulid();
    const deviceData = {
      id: deviceId,
      device_path: mount.device,
      mount_point: mount.mountPoint,
      label: label || undefined,
      total_space_gb: space?.totalGb || null,
      available_space_gb: space?.availableGb || null,
      is_mounted: true,
      last_seen: new Date().toISOString()
    };

    // Check if device already exists in database
    const [existing] = await db
      .select()
      .from(usbDevices)
      .where(eq(usbDevices.device_path, mount.device))
      .limit(1);

    if (existing) {
      // Update existing device
      await db
        .update(usbDevices)
        .set({
          mount_point: mount.mountPoint,
          label: label || undefined,
          total_space_gb: space?.totalGb || null,
          available_space_gb: space?.availableGb || null,
          is_mounted: true,
          last_seen: new Date().toISOString()
        })
        .where(eq(usbDevices.id, existing.id));

      detectedDevices.push({
        id: existing.id,
        devicePath: mount.device,
        mountPoint: mount.mountPoint,
        label: label || undefined,
        totalSpaceGb: space?.totalGb || undefined,
        availableSpaceGb: space?.availableGb || undefined,
        isMounted: true,
        lastSeen: new Date().toISOString()
      });
    } else {
      // Insert new device
      await db.insert(usbDevices).values(deviceData);

      detectedDevices.push({
        id: deviceId,
        devicePath: mount.device,
        mountPoint: mount.mountPoint,
        label: label || undefined,
        totalSpaceGb: space?.totalGb || undefined,
        availableSpaceGb: space?.availableGb || undefined,
        isMounted: true,
        lastSeen: new Date().toISOString()
      });
    }
  }

  // Mark unmounted devices
  const allDevices = await db.select().from(usbDevices);
  const mountedPaths = mountedDevices.map((m) => m.device);

  for (const device of allDevices) {
    if (!mountedPaths.includes(device.device_path)) {
      await db
        .update(usbDevices)
        .set({
          is_mounted: false,
          mount_point: null,
          last_seen: new Date().toISOString()
        })
        .where(eq(usbDevices.id, device.id));
    }
  }

  return detectedDevices;
}

/**
 * List all USB devices from database
 */
export async function listUSBDevices(): Promise<USBDeviceResponse[]> {
  const devices = await db
    .select()
    .from(usbDevices)
    .orderBy(desc(usbDevices.last_seen));

  return devices.map((d) => ({
    id: d.id,
    devicePath: d.device_path,
    mountPoint: d.mount_point || undefined,
    label: d.label || undefined,
    totalSpaceGb: d.total_space_gb || undefined,
    availableSpaceGb: d.available_space_gb || undefined,
    isMounted: Boolean(d.is_mounted),
    lastSeen: d.last_seen
  }));
}

/**
 * Get USB device by ID
 */
export async function getUSBDeviceById(deviceId: string): Promise<USBDeviceResponse | null> {
  const [device] = await db
    .select()
    .from(usbDevices)
    .where(eq(usbDevices.id, deviceId))
    .limit(1);

  if (!device) return null;

  return {
    id: device.id,
    devicePath: device.device_path,
    mountPoint: device.mount_point || undefined,
    label: device.label || undefined,
    totalSpaceGb: device.total_space_gb || undefined,
    availableSpaceGb: device.available_space_gb || undefined,
    isMounted: Boolean(device.is_mounted),
    lastSeen: device.last_seen
  };
}

/**
 * Mount USB device
 * Creates mount point if it doesn't exist
 */
export async function mountUSBDevice(devicePath: string): Promise<void> {
  const mountPoint = '/mnt/escapeplan-backup';

  // Create mount point directory
  await fs.mkdir(mountPoint, { recursive: true });

  try {
    // Mount device
    await execAsync(`sudo mount ${devicePath} ${mountPoint}`);

    // Update database
    const [device] = await db
      .select()
      .from(usbDevices)
      .where(eq(usbDevices.device_path, devicePath))
      .limit(1);

    if (device) {
      await db
        .update(usbDevices)
        .set({
          is_mounted: true,
          mount_point: mountPoint,
          last_seen: new Date().toISOString()
        })
        .where(eq(usbDevices.id, device.id));
    }
  } catch (error) {
    throw new Error(`Failed to mount USB device: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unmount USB device
 */
export async function unmountUSBDevice(devicePath: string): Promise<void> {
  try {
    await execAsync(`sudo umount ${devicePath}`);

    // Update database
    const [device] = await db
      .select()
      .from(usbDevices)
      .where(eq(usbDevices.device_path, devicePath))
      .limit(1);

    if (device) {
      await db
        .update(usbDevices)
        .set({
          is_mounted: false,
          mount_point: null,
          last_seen: new Date().toISOString()
        })
        .where(eq(usbDevices.id, device.id));
    }
  } catch (error) {
    throw new Error(`Failed to unmount USB device: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean up old USB device records (older than 30 days)
 */
export async function cleanupOldUSBDevices(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const oldDevices = await db
    .select()
    .from(usbDevices)
    .where(eq(usbDevices.is_mounted, false));

  for (const device of oldDevices) {
    if (device.last_seen < thirtyDaysAgo) {
      await db.delete(usbDevices).where(eq(usbDevices.id, device.id));
    }
  }
}
