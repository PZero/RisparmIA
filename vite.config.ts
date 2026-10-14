/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serve il sito sotto /RisparmIA/. In sviluppo si usa la radice.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'RisparmIA',
        short_name: 'RisparmIA',
        description: 'Portafoglio familiare con strategie di risparmio. Dati cifrati sul tuo dispositivo.',
        lang: 'it',
        theme_color: '#0f766e',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nessun runtimeCaching: il service worker mette in cache solo i file
        // statici dell'app, mai le chiamate a Firebase.
        navigateFallbackDenylist: [/^\/__\//]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Firebase in un file a parte: cambia di rado e resta in cache.
        manualChunks: (id) => (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase') ? 'firebase' : undefined)
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
