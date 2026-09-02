import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — relative asset paths, so the build runs unchanged from a
// server root, from /deskarium/dist/, or from GitHub Pages. Nothing to
// reconfigure when the serve location moves.
//
// Multiple HTML entries, one per variant (see main.tsx), each landing at
// its own dist/*.html URL: dist/index.html, dist/upside-down.html,
// dist/light.html, dist/upside-down-light.html. Same App, same bundle
// logic — the variant differs only by a data-variant attribute read at
// boot.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        index: 'index.html',
        'upside-down': 'upside-down.html',
        light: 'light.html',
        'upside-down-light': 'upside-down-light.html',
        // The Pi's own page; builds to dist/rpi/index.html.
        rpi: 'rpi/index.html',
      },
    },
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
        /* Never answer a request for a named page with a different
           page. Workbox's navigation fallback matches *any* navigation
           the precache misses, so a service worker installed before a
           variant existed answers /light.html with index.html — which
           renders as the plain clock-driven tank and looks exactly like
           the light page "reverting to dark", with no error anywhere to
           suggest the wrong document was served.

           Every page here is a real file and there is no client-side
           router, so an explicit *.html URL should be served or fail.
           The fallback stays for the bare directory URL. start_url
           and the kiosk both name a variant page directly, and those
           are precached, so they are served as themselves.

           catchment/ is a separate static page in this repository, not a
           Deskarium variant, and it is not precached. It is denied
           explicitly: the worker's scope is dist/ today and cannot reach
           it, but if the Pages source is ever switched to dist-as-root the
           scope becomes the whole repository and a bare /catchment/ URL
           would be answered with Deskarium's index.html — the same silent
           wrong-document failure described above, with no error anywhere. */
        navigateFallbackDenylist: [/\.html$/, /\/catchment\//],
      },
      manifest: {
        name: 'Deskarium',
        short_name: 'Deskarium',
        description: 'A sound-responsive ASCII aquarium for a small desk panel.',
        start_url: './rpi/index.html',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        // Splash colours follow the page start_url opens, or the
        // installed app flashes dark before a light tank appears.
        background_color: '#b3e2fd',
        theme_color: '#b3e2fd',
        icons: [
          { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
