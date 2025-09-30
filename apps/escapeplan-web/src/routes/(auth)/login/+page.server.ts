import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

const API_BASE = (PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

function parseSetCookie(header: string | null) {
  if (!header) return null;
  const parts = header.split(';').map((part) => part.trim());
  const [namePart, ...attrParts] = parts;
  const [name, rawValue] = namePart.split('=');
  if (!name || rawValue === undefined) return null;
  const value = decodeURIComponent(rawValue);

  const attributes: Record<string, string | true> = {};
  for (const attr of attrParts) {
    const [attrName, attrValue] = attr.split('=');
    if (!attrName) continue;
    attributes[attrName.toLowerCase()] = attrValue ? attrValue : true;
  }

  return { name, value, attributes };
}

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const { request } = event;
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
      return fail(400, { message: 'Username and password are required.' });
    }

    try {
      const response = await event.fetch(`${API_BASE}/auth/sign-in/username`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe: true })
      });

      if (!response.ok) {
        let message = 'Invalid credentials';
        try {
          const body = await response.json();
          if (body && typeof body.message === 'string') {
            message = body.message;
          }
        } catch {
          // ignore
        }
        return fail(response.status, { message });
      }

      const setCookie = parseSetCookie(response.headers.get('set-cookie'));
      if (!setCookie || setCookie.name !== 'better-auth.session_token') {
        return fail(500, { message: 'Authentication cookie missing.' });
      }

      event.cookies.set(setCookie.name, setCookie.value, {
        path: typeof setCookie.attributes.path === 'string' ? setCookie.attributes.path : '/',
        httpOnly: true,
        sameSite: (typeof setCookie.attributes.samesite === 'string'
          ? setCookie.attributes.samesite.toLowerCase()
          : 'lax') as 'lax' | 'strict' | 'none',
        secure: Boolean(setCookie.attributes.secure),
        maxAge:
          typeof setCookie.attributes['max-age'] === 'string'
            ? Number(setCookie.attributes['max-age'])
            : undefined
      });

      throw redirect(303, '/dashboard');
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
        throw error;
      }
      console.error('Unexpected login error', error);
      return fail(500, { message: 'Unable to sign in right now.' });
    }
  }
};
