import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { NetworkProfile, ApplyNetworkConfigResponse, ApplyNetworkConfigRequest } from '$lib/api/types';

const parseKeyValueBlock = (value: FormDataEntryValue | null): Record<string, string> | undefined => {
  if (!value) return undefined;
  const lines = value.toString().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return undefined;
  const entries: Array<[string, string]> = [];
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (!key || rest.length === 0) {
      throw new Error(`Invalid key=value pair: ${line}`);
    }
    entries.push([key.trim(), rest.join('=').trim()]);
  }
  return Object.fromEntries(entries);
};

export const load: PageServerLoad = async (event) => {
  const { locals } = event;
  const user = locals.user;
  if (!user || !user.permissions?.includes('view_network')) {
    throw error(403, 'Permission denied');
  }

  const fetcher = makeServerFetcher(event);
  const profile = await fetcher<NetworkProfile>('/admin/network');

  return {
    profile,
    canManage: user.permissions?.includes('manage_network') ?? false
  };
};

export const actions: Actions = {
  update: async (event) => {
    const { locals, request } = event;
    if (!locals.user || !locals.user.permissions?.includes('manage_network')) {
      return fail(403, { message: 'Permission denied.' });
    }

    const data = await request.formData();
    const payload = {
      name: data.get('name')?.toString().trim() || undefined,
      ssid: data.get('ssid')?.toString().trim() || undefined,
      description: data.get('description')?.toString().trim() || undefined,
      band: data.get('band')?.toString().trim() || undefined,
      channel: data.get('channel') ? Number(data.get('channel')) : undefined,
      security: data.get('security')?.toString().trim() || undefined,
      broadcastEnabled: data.get('broadcastEnabled') === 'on',
      status: data.get('status')?.toString().trim() || undefined,
      statusMessage: data.get('statusMessage')?.toString().trim() || undefined,
      details: data.get('details')?.toString().trim() || undefined
    };

    try {
      const fetcher = makeServerFetcher(event);
      const profile = await fetcher<NetworkProfile>('/admin/network', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return { success: true, profile };
    } catch (err) {
      console.error('Failed to update network profile', err);
      return fail(500, { message: 'Unable to update network profile.' });
    }
  },
  provision: async (event) => {
    const { locals, request } = event;
    if (!locals.user || !locals.user.permissions?.includes('manage_network')) {
      return fail(403, { message: 'Permission denied.' });
    }

    const data = await request.formData();
    const required = (key: string) => {
      const value = data.get(key)?.toString().trim();
      if (!value) {
        throw new Error(`Missing required field: ${key}`);
      }
      return value;
    };

    try {
      const payload = {
        wifi: {
          ssid: required('wifiSsid'),
          passphrase: required('wifiPassphrase'),
          channel: Number(required('wifiChannel')),
          band: (data.get('wifiBand')?.toString().trim() || 'auto') as '2g' | '5g' | 'auto',
          country: data.get('wifiCountry')?.toString().trim() || undefined
        },
        network: {
          router: required('networkRouter'),
          dns: required('networkDns'),
          dhcpRangeStart: required('dhcpStart'),
          dhcpRangeEnd: required('dhcpEnd'),
          domain: required('networkDomain')
        },
        nginx: {
          serverName: data.get('serverName')?.toString().trim() || required('networkDomain'),
          apiUpstream: data.get('apiUpstream')?.toString().trim() || 'http://127.0.0.1:4000',
          webRoot: '/opt/escapeplan/web/build/client',
          webUpstream: data.get('webUpstream')?.toString().trim() || 'http://127.0.0.1:4173'
        },
        env: {
          api: parseKeyValueBlock(data.get('apiEnv')),
          web: parseKeyValueBlock(data.get('webEnv'))
        },
        services: {
          enableApi: data.get('enableApi') === 'on',
          enableWeb: data.get('enableWeb') === 'on',
          enableWifi: data.get('enableWifi') === 'on'
        }
      } satisfies ApplyNetworkConfigRequest;

      const fetcher = makeServerFetcher(event);
      const result = await fetcher<ApplyNetworkConfigResponse>('/admin/network/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const profile = await fetcher<NetworkProfile>('/admin/network');
      return { success: true, profile, applied: result };
    } catch (err) {
      console.error('Failed to apply network configuration', err);
      return fail(500, { message: err instanceof Error ? err.message : 'Unable to apply configuration.' });
    }
  }
};
