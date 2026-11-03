import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifiesto } from './src/pwa/manifiesto.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: genera el manifiesto y un service worker que guarda solo los
    // archivos de la propia app (HTML, JS, CSS, íconos) para abrirla rápido
    // y sin conexión. No se guarda ninguna respuesta de la API ni de la
    // autenticación: los datos del negocio nunca quedan en la caché del
    // navegador (la sincronización sin conexión se diseña aparte).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: manifiesto,
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
