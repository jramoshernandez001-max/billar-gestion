/**
 * Pruebas de las rutas de la interfaz.
 *
 * Qué hace: verifica cómo se lee la ruta desde la dirección (#/inventario) y
 * a qué pestaña de la barra inferior pertenece.
 * Cómo lo hace: funciones puras con casos de ejemplo.
 * Por qué: una ruta desconocida no debe dejar la app en blanco, y la pestaña
 * activa debe resaltarse bien también en las pantallas internas.
 */
import { describe, it, expect } from 'vitest'
import { pestanaDe, rutaDesdeHash, segmentosDeRuta } from './ruta'

describe('rutaDesdeHash', () => {
  it('lee la ruta sin el signo # ni la barra inicial', () => {
    expect(rutaDesdeHash('#/inventario')).toBe('inventario')
    expect(rutaDesdeHash('#/deudas/nueva')).toBe('deudas/nueva')
  })
  it('sin ruta, o con una vacía, es el inicio', () => {
    expect(rutaDesdeHash('')).toBe('inicio')
    expect(rutaDesdeHash('#')).toBe('inicio')
    expect(rutaDesdeHash('#/')).toBe('inicio')
  })
})

describe('pestanaDe', () => {
  it('cada pestaña principal se reconoce por su primer tramo', () => {
    expect(pestanaDe('inicio')).toBe('inicio')
    expect(pestanaDe('vender')).toBe('vender')
    expect(pestanaDe('inventario/trasladar')).toBe('inventario')
    expect(pestanaDe('deudas/nueva')).toBe('deudas')
    expect(pestanaDe('mas')).toBe('mas')
  })
  it('una ruta desconocida no resalta ninguna pestaña', () => {
    expect(pestanaDe('quien-sabe')).toBeNull()
  })
})

describe('segmentosDeRuta', () => {
  it('parte la ruta en tramos', () => {
    expect(segmentosDeRuta('inventario/trasladar/abc')).toEqual(['inventario', 'trasladar', 'abc'])
    expect(segmentosDeRuta('inicio')).toEqual(['inicio'])
  })
  it('ignora tramos vacíos y decodifica los identificadores', () => {
    expect(segmentosDeRuta('inventario//ajustar/a%20b/')).toEqual(['inventario', 'ajustar', 'a b'])
  })
  it('un tramo con codificación rota se deja tal cual', () => {
    expect(segmentosDeRuta('inventario/%E0%A4%A')).toEqual(['inventario', '%E0%A4%A'])
  })
})
