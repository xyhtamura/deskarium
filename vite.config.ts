import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — relative asset paths, so the build runs unchanged from a
// server root, from /deskarium/dist/, or from GitHub Pages. Nothing to
// reconfigure when the serve location moves.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        // Everything is local; no runtime API traffic to route around.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Deskarium',
        short_name: 'Deskarium',
        description: 'A sound-responsive ASCII aquarium for a small desk panel.',
        start_url: './index.html',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#061218',
        theme_color: '#061218',
        icons: [
          { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
