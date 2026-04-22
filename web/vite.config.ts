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
});
