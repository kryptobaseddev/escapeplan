import type { PluginOption } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const tailwindPlugin = tailwindcss() as PluginOption;
const pwaPlugin = SvelteKitPWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'logo.png',
        'robots.txt'
      ],
      manifestFilename: 'site.webmanifest',
      manifest: {
        id: '/',
        name: 'EscapePlan Operator Console',
        short_name: 'EscapePlan',
        description:
          'EscapePlan operators manage bookings, rooms, timers, and hints from any device on the EscapePlan network.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'landscape',
        theme_color: '#0B0F10',
        background_color: '#0B0F10',
        categories: ['business', 'productivity'],
        screenshots: [
          {
            src: '/logo.png',
            sizes: '539x680',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'EscapePlan neon maze crest'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: '/dashboard',
            description: 'Review live sessions and system status.'
          },
          {
            name: 'Bookings',
            short_name: 'Bookings',
            url: '/bookings',
            description: 'Manage storefront and mobile bookings.'
          }
        ],
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/favicon.ico',
            sizes: '48x48 32x32 16x16',
            type: 'image/x-icon'
          }
        ]
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true
      }
    }) as PluginOption;

export default defineConfig({
  plugins: [tailwindPlugin, sveltekit(), pwaPlugin],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
