import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'India Learns',
        short_name: 'India Learns',
        description: 'India Learns — LMS for LUC Diploma Programs.',
        theme_color: '#F58220',
        background_color: '#FBF5E8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
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
