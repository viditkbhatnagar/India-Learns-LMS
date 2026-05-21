import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: vite-plugin-pwa removed for the initial staging rollout. The server
// (api/src/app.ts) now serves a kill-switch `/sw.js` that actively
// unregisters any service worker left over from earlier deploys — this
// prevents the "You're offline" lock-out we saw on first staging. The
// PWA manifest is still shipped as a static file in web/public/ so native
// "Install" prompts keep working. Re-enable VitePWA() here after the UX
// stabilises and offline/update-banner UX is designed properly.
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    // Manual chunks isolate the two heaviest groups so the initial page
    // load doesn't pull them in:
    //   - charts: recharts + d3 helpers, only used on AdminDashboard + analytics
    //   - sentry: @sentry/react, only used by ErrorBoundary on app boot
    //   - vendor-react: react + react-dom + react-router, shared everywhere
    // Everything else stays in the default route-split chunks Vite creates.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('/d3-')) return 'charts';
            if (id.includes('@sentry')) return 'sentry';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
          }
          return undefined;
        },
      },
    },
    // 600 kB is a sane gzipped-warning ceiling once the heavy chunks are split.
    chunkSizeWarningLimit: 600,
  },
});
