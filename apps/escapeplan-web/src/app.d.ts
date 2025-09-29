/// <reference types="vite-plugin-pwa/client" />

import type { OperatorProfile } from '$lib/api/types';

declare global {
  namespace App {
    interface Locals {
      user: OperatorProfile | null;
      sessionToken: string | null;
    }

    interface PageData {
      user?: OperatorProfile | null;
    }
  }
}

export {};
