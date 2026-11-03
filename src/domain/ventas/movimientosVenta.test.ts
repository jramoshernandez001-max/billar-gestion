/**
 * Pruebas de la conversión de una venta en movimientos de inventario.
 *
 * Qué hace: verifica que cada renglón de una venta se convierta en una
 * salida de la nevera por las unidades vendidas.
 * Cómo lo hace: arma ventas de ejemplo con productos y precios inventados y
 * compara los movimientos con lo esperado, y con el stock que resulta.
 * Por qué: la venta es lo que descuenta producto de la nevera; si las
 * unidades salen mal, el stock y el cierre dejan de cuadrar.
 */
import { describe, it, expect } from 'vitest'
import { calcularStock } from '../inventario/stock'
import { ventaAMovimientos, type RenglonVenta } from './movimientosVenta'

// Productos de ejemplo inventados.
const cervezaA = { unidadesPorCaja: 20, manejaSixpack: true, precioUnidad: 2000, precioCaja: 38000 }
const cervezaB = { unidadesPorCaja: 30, manejaSixpack: false, precioUnidad: 2500, precioCaja: 70000 }

describe('ventaAMovimientos', () => {
  it('cada renglón sale de la nevera en unidades', () => {
    const renglones: RenglonVenta[] = [
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1 },
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'sixpack', cantidad: 2 },
      { productoId: 'cerveza-b', producto: cervezaB, presentacion: 'unidad', cantidad: 4 },
    ]
    expect(ventaAMovimientos(renglones)).toEqual([
      { productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: -20 },
      { productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: -12 },
      { productoId: 'cerveza-b', tipo: 'venta', ubicacion: 'nevera', unidades: -4 },
    ])
  })

  it('el precio cobrado no cambia las unidades que salen', () => {
    const renglones: RenglonVenta[] = [
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1, precioCobrado: 35000 },
    ]
    expect(ventaAMovimientos(renglones)[0].unidades).toBe(-20)
  })

  it('descuenta del stock de la nevera', () => {
    const renglones: RenglonVenta[] = [
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 3 },
    ]
    expect(calcularStock(ventaAMovimientos(renglones), 'cerveza-a')).toEqual({
      bodega: 0,
      nevera: -3,
      total: -3,
    })
  })

  it('un renglón de cantidad cero da un movimiento de cero, no de menos cero', () => {
    const renglones: RenglonVenta[] = [
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 0 },
    ]
    expect(Object.is(ventaAMovimientos(renglones)[0].unidades, 0)).toBe(true)
  })

  it('una venta sin renglones no genera movimientos', () => {
    expect(ventaAMovimientos([])).toEqual([])
  })

  it('rechaza sixpack en un producto que no lo maneja y cantidades inválidas', () => {
    expect(() =>
      ventaAMovimientos([{ productoId: 'cerveza-b', producto: cervezaB, presentacion: 'sixpack', cantidad: 1 }]),
    ).toThrow(/sixpack/i)
    expect(() =>
      ventaAMovimientos([{ productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: -1 }]),
    ).toThrow()
  })
})
