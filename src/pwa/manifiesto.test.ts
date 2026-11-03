/**
 * Pruebas del manifiesto de la PWA.
 *
 * Qué hace: verifica que el manifiesto cumpla lo que los navegadores exigen
 * para ofrecer "instalar la app" en el celular.
 * Cómo lo hace: revisa nombre, idioma, modo de pantalla, colores e íconos.
 * Por qué: si falta un ícono de 192 o 512 px o el modo `standalone`, el
 * navegador no ofrece instalar y nadie se entera hasta probar en el celular.
 */
import { describe, it, expect } from 'vitest'
import { manifiesto } from './manifiesto'

describe('manifiesto', () => {
  it('tiene nombre, idioma español y abre como app independiente', () => {
    expect(manifiesto.name).toBe('Billar Gestión')
    expect(manifiesto.short_name.length).toBeLessThanOrEqual(12)
    expect(manifiesto.lang).toBe('es')
    expect(manifiesto.display).toBe('standalone')
    expect(manifiesto.start_url).toBe('/')
  })

  it('define colores válidos', () => {
    expect(manifiesto.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifiesto.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('incluye íconos de 192 y 512 px, y uno que se adapta a la máscara', () => {
    const tamanos = manifiesto.icons.map((i) => i.sizes)
    expect(tamanos).toContain('192x192')
    expect(tamanos).toContain('512x512')
    expect(manifiesto.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icono of manifiesto.icons) expect(icono.type).toBe('image/png')
  })
})
