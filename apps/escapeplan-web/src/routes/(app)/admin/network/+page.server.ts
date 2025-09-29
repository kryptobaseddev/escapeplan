import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { NetworkProfile } from '$lib/api/types';

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
    } catch (error) {
      console.error('Failed to update network profile', error);
      return fail(500, { message: 'Unable to update network profile.' });
    }
  }
};
