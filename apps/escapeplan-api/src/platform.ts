import { promises as fs } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { ApplyNetworkConfigRequest, ApplyNetworkConfigResponse } from '@escapeplan/contracts';

const execFileAsync = promisify(execFile);
const CONFIG_APPLY_BIN = process.env.ESCAPEPLAN_CONFIG_APPLY_PATH ?? '/usr/local/sbin/escapeplan-config-apply';

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function queryServiceState(service: string): Promise<'active' | 'inactive' | 'unknown'> {
  try {
    await execFileAsync('systemctl', ['is-active', service]);
    return 'active';
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 3) {
      return 'inactive';
    }
    return 'unknown';
  }
}

async function queryNMConnectionState(connectionName: string): Promise<'active' | 'inactive' | 'unknown'> {
  try {
    const output = execSync(`nmcli -t -f GENERAL.STATE connection show "${connectionName}"`, {
      encoding: 'utf8',
      timeout: 5000
    });
    return output.includes('activated') ? 'active' : 'inactive';
  } catch {
    return 'unknown';
  }
}

export async function applyEscapePlanConfig(payload: ApplyNetworkConfigRequest): Promise<ApplyNetworkConfigResponse> {
  if (!(await commandExists(CONFIG_APPLY_BIN))) {
    throw new Error(`Configuration tool not found at ${CONFIG_APPLY_BIN}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'escapeplan-config-'));
  const configPath = join(tempDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(payload, null, 2), 'utf8');

  try {
    const { stdout, stderr } = await execFileAsync(CONFIG_APPLY_BIN, ['--config', configPath], {
      timeout: 60_000
    });

    const [apConnection, api, web] = await Promise.all([
      queryNMConnectionState('escapeplan-ap'),
      queryServiceState('escapeplan-api.service'),
      queryServiceState('escapeplan-web.service')
    ]);

    return {
      appliedAt: new Date().toISOString(),
      stdout: stdout.trim() || undefined,
      stderr: stderr.trim() || undefined,
      services: {
        apConnection,
        api,
        web
      }
    };
  } finally {
    await fs.rm(configPath, { force: true });
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
