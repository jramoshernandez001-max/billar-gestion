/**
 * Pruebas de la verificación de disponibilidad de stock.
 *
 * Qué hace: comprueba que, antes de sacar unidades de la bodega o de la
 * nevera, se sepa si alcanzan y cuántas faltan en caso contrario.
 * Cómo lo hace: parte de un stock de ejemplo y compara el resultado de
 * verificarDisponibilidad con lo esperado.
 * Por qué: evita registrar ventas o traslados de producto que no existe y
 * deja avisar al usuario antes de que el inventario quede en negativo.
 */
import { describe, it, expect } from 'vitest'
import { verificarDisponibilidad } from './disponibilidad'
import type { Stock } from './stock'

// Stock de ejemplo: 100 unidades en bodega y 30 en nevera.
const stock: Stock = { bodega: 100, nevera: 30, total: 130 }

describe('verificarDisponibilidad', () => {
  it('alcanza cuando se pide menos de lo que hay', () => {
    expect(verificarDisponibilidad(stock, 'nevera', 10)).toEqual({
      suficiente: true,
      faltan: 0,
    })
  })

  it('alcanza cuando se pide exactamente lo que hay', () => {
    expect(verificarDisponibilidad(stock, 'nevera', 30)).toEqual({
      suficiente: true,
      faltan: 0,
    })
  })

  it('no alcanza y dice cuántas unidades faltan', () => {
    expect(verificarDisponibilidad(stock, 'nevera', 35)).toEqual({
      suficiente: false,
      faltan: 5,
    })
  })

  it('mira solo la ubicación pedida, no el total', () => {
    const sinNevera: Stock = { bodega: 100, nevera: 0, total: 100 }
    expect(verificarDisponibilidad(sinNevera, 'nevera', 1)).toEqual({
      suficiente: false,
      faltan: 1,
    })
  })

  it('pedir cero unidades siempre alcanza', () => {
    expect(verificarDisponibilidad(stock, 'bodega', 0).suficiente).toBe(true)
  })

  it('rechaza cantidades negativas o con decimales', () => {
    expect(() => verificarDisponibilidad(stock, 'nevera', -1)).toThrow()
    expect(() => verificarDisponibilidad(stock, 'nevera', 2.5)).toThrow()
  })
})