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
    // y sin conexión. El service worker no guarda ninguna respuesta de la API
    // ni de la autenticación. Los datos para trabajar sin conexión (cola de
    // registros pendientes y últimas lecturas) los guarda la propia app en
    // localStorage (src/sincronizacion) y las copias se borran al cerrar sesión.
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
