/**
 * Pruebas de los traslados de bodega a nevera.
 *
 * Qué hace: verifica que un traslado se convierta en dos movimientos (sale
 * de la bodega y entra a la nevera) y que avise cuando la bodega no alcanza.
 * Cómo lo hace: parte de un stock de ejemplo inventado y compara los
 * movimientos y el aviso con lo esperado.
 * Por qué: el traslado no cambia el total del inventario, solo dónde está;
 * si los dos movimientos no cuadran, el stock de la nevera queda mal.
 */
import { describe, it, expect } from 'vitest'
import { calcularStock, type Stock } from './stock'
import { trasladarANevera } from './traslados'

// Stock de ejemplo: 50 unidades en bodega y 10 en nevera.
const stock: Stock = { bodega: 50, nevera: 10, total: 60 }

describe('trasladarANevera', () => {
  it('genera un movimiento que sale de bodega y otro que entra a nevera', () => {
    const { movimientos } = trasladarANevera('cerveza-a', 20, stock)
    expect(movimientos).toEqual([
      { productoId: 'cerveza-a', tipo: 'traslado', ubicacion: 'bodega', unidades: -20 },
      { productoId: 'cerveza-a', tipo: 'traslado', ubicacion: 'nevera', unidades: 20 },
    ])
  })

  it('no cambia el total del inventario', () => {
    const { movimientos } = trasladarANevera('cerveza-a', 20, stock)
    expect(calcularStock(movimientos, 'cerveza-a').total).toBe(0)
  })

  it('cuando la bodega alcanza, la disponibilidad lo dice', () => {
    expect(trasladarANevera('cerveza-a', 50, stock).disponibilidad).toEqual({
      suficiente: true,
      faltan: 0,
    })
  })

  it('cuando la bodega no alcanza, avisa cuántas faltan pero igual arma los movimientos', () => {
    const resultado = trasladarANevera('cerveza-a', 55, stock)
    expect(resultado.disponibilidad).toEqual({ suficiente: false, faltan: 5 })
    expect(resultado.movimientos).toHaveLength(2)
  })

  it('rechaza trasladar cero unidades o cantidades inválidas', () => {
    expect(() => trasladarANevera('cerveza-a', 0, stock)).toThrow()
    expect(() => trasladarANevera('cerveza-a', -3, stock)).toThrow()
    expect(() => trasladarANevera('cerveza-a', 2.5, stock)).toThrow()
  })
})
