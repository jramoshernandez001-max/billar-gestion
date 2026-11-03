/**
 * Manifiesto de la PWA.
 *
 * Qué hace: describe la app para el navegador: nombre, colores, modo de
 * pantalla e íconos.
 * Cómo lo hace: un objeto simple que vite.config.ts entrega al plugin PWA,
 * que lo publica como `manifest.webmanifest`.
 * Por qué: con esto el navegador del celular ofrece instalar la app y la abre
 * a pantalla completa, como una app nativa. Los colores y los íconos son
 * provisionales hasta que Juan entregue su diseño de Figma.
 */
import type { ManifestOptions } from 'vite-plugin-pwa'

export const manifiesto = {
  name: 'Billar Gestión',
  short_name: 'Billar',
  description: 'Inventario, ventas, cierres y deudas del billar.',
  lang: 'es',
  start_url: '/',
  scope: '/',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  // Provisionales: se cambian con la paleta del diseño.
  theme_color: '#0b6b3a',
  background_color: '#0b6b3a',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
    { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
  ],
} satisfies Partial<ManifestOptions>
