/**
 * Pruebas de las categorías de producto.
 *
 * Qué hace: verifica qué presentaciones admite cada categoría, cómo se llaman
 * y cómo se filtra por categoría.
 * Cómo lo hace: funciones puras con datos de ejemplo.
 * Por qué: el licor se vende por botella entera; la cerveza y los otros
 * productos siguen con unidad, sixpack y caja.
 */
import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS,
  esCategoria,
  etiquetaCategoria,
  filtrarPorCategoria,
  opcionesDePresentacion,
  presentacionPermitida,
} from './categorias'

describe('categorías', () => {
  it('son cerveza, licor y otro, con su nombre para mostrar', () => {
    expect(CATEGORIAS).toEqual(['cerveza', 'licor', 'otro'])
    expect(etiquetaCategoria('cerveza')).toBe('Cerveza')
    expect(etiquetaCategoria('licor')).toBe('Licor')
    expect(etiquetaCategoria('otro')).toBe('Otros')
  })

  it('esCategoria reconoce solo las válidas', () => {
    expect(esCategoria('licor')).toBe(true)
    expect(esCategoria('ron')).toBe(false)
    expect(esCategoria(3)).toBe(false)
  })
})

describe('presentaciones por categoría', () => {
  it('el licor solo se vende por botella (unidad)', () => {
    expect(presentacionPermitida('licor', 'unidad', false)).toBe(true)
    expect(presentacionPermitida('licor', 'caja', false)).toBe(false)
    expect(presentacionPermitida('licor', 'sixpack', true)).toBe(false)
  })

  it('cerveza y otros: unidad y caja siempre; sixpack solo si el producto lo maneja', () => {
    for (const c of ['cerveza', 'otro'] as const) {
      expect(presentacionPermitida(c, 'unidad', false)).toBe(true)
      expect(presentacionPermitida(c, 'caja', false)).toBe(true)
      expect(presentacionPermitida(c, 'sixpack', false)).toBe(false)
      expect(presentacionPermitida(c, 'sixpack', true)).toBe(true)
    }
  })

  it('las opciones del licor son solo "Botella"', () => {
    expect(opcionesDePresentacion('licor', false)).toEqual([{ valor: 'unidad', etiqueta: 'Botella' }])
  })

  it('las opciones de cerveza tachan el sixpack si no se maneja', () => {
    expect(opcionesDePresentacion('cerveza', false)).toEqual([
      { valor: 'unidad', etiqueta: 'Unidad' },
      { valor: 'sixpack', etiqueta: 'Sixpack', noDisponible: true },
      { valor: 'caja', etiqueta: 'Caja' },
    ])
    expect(opcionesDePresentacion('otro', true)[1]).toEqual({ valor: 'sixpack', etiqueta: 'Sixpack', noDisponible: false })
  })
})

describe('filtrarPorCategoria', () => {
  const lista = [
    { id: 'a', categoria: 'cerveza' as const },
    { id: 'b', categoria: 'licor' as const },
    { id: 'c', categoria: 'cerveza' as const },
  ]
  it('"todas" deja todo', () => {
    expect(filtrarPorCategoria(lista, 'todas')).toHaveLength(3)
  })
  it('deja solo la categoría pedida', () => {
    expect(filtrarPorCategoria(lista, 'cerveza').map((p) => p.id)).toEqual(['a', 'c'])
    expect(filtrarPorCategoria(lista, 'otro')).toEqual([])
  })
})
