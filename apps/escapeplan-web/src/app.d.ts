/// <reference types="vite-plugin-pwa/client" />

import type { AuthSessionInfo, AuthSessionUser } from '$lib/api/types';

declare global {
  namespace App {
    interface Locals {
      user: AuthSessionUser | null;
      session: AuthSessionInfo | null;
    }

    interface PageData {
      user?: AuthSessionUser | null;
      session?: AuthSessionInfo | null;
    }
  }
}

export {};
