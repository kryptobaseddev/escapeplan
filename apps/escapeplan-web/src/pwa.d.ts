declare module 'virtual:pwa-info' {
  export const pwaInfo: {
    webManifest?: {
      linkTag?: string;
    };
  } | undefined;
}

declare module 'virtual:pwa-assets/head' {
  export const pwaAssetsHead: {
    themeColor?: { content: string };
    links: Array<Record<string, string>>;
  };
}

declare module 'virtual:pwa-register/svelte' {
  type UseRegisterSWOptions = {
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  };
  export function useRegisterSW(options?: UseRegisterSWOptions): {
    offlineReady: import('svelte/store').Writable<boolean>;
    needRefresh: import('svelte/store').Writable<boolean>;
    updateServiceWorker: (reload?: boolean) => Promise<void>;
  };
}
