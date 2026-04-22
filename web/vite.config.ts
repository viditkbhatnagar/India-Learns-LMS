import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // M9 — workbox-window registers the SW from main.tsx so we can surface
      // an update banner; vite-plugin-pwa just generates the SW + manifest.
      registerType: 'prompt',
      injectRegister: false,
      filename: 'sw.js',
      devOptions: { enabled: false },
      manifest: {
        name: 'India Learns',
        short_name: 'India Learns',
        description: 'India Learns — LMS for Diploma Programs.',
        theme_color: '#1A3A8F',
        background_color: '#FBF5E8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/v1\//],
        runtimeCaching: [
          {
            // Stable APIs — fast first paint, refresh in background.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/v1/me/') ||
              url.pathname === '/v1/students/me/dashboard',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'il-api-me',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Cloudinary media — cache aggressively.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'il-media',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
  },
});
