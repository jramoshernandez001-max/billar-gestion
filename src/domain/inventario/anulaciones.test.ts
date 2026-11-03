/**
 * Pruebas de los movimientos que anulan otros movimientos.
 *
 * Qué hace: verifica que, dado un conjunto de movimientos (de una compra, un
 * traslado o una venta), se produzcan los movimientos inversos que lo
 * compensan, sin borrar nada.
 * Cómo lo hace: arma movimientos de ejemplo inventados, calcula sus inversos
 * y comprueba que juntos dejen el stock como estaba.
 * Por qué: nada se borra; una anulación agrega movimientos contrarios, así
 * el historial queda completo y el stock vuelve a cuadrar.
 */
import { describe, it, expect } from 'vitest'
import { compraAMovimiento } from './compras'
import { movimientosInversos } from './anulaciones'
import { calcularStock, type Movimiento } from './stock'
import { trasladarANevera } from './traslados'

describe('movimientosInversos', () => {
  it('invierte el signo y conserva producto, tipo y ubicación', () => {
    const venta: Movimiento[] = [
      { productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: -12 },
    ]
    expect(movimientosInversos(venta)).toEqual([
      { productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: 12 },
    ])
  })

  it('anular una compra deja la bodega como estaba', () => {
    const compra = compraAMovimiento({
      id: 'compra-1',
      productoId: 'cerveza-a',
      producto: { unidadesPorCaja: 20, manejaSixpack: false },
      presentacion: 'caja',
      cantidad: 2,
      costoTotal: 50000,
      fecha: '2026-03-09',
      registradoEn: '2026-03-09T15:00:00.000Z',
    })
    const historial = [compra, ...movimientosInversos([compra])]
    expect(calcularStock(historial, 'cerveza-a')).toEqual({ bodega: 0, nevera: 0, total: 0 })
  })

  it('anular un traslado devuelve las unidades a la bodega', () => {
    const inicial: Movimiento = { productoId: 'cerveza-a', tipo: 'compra', ubicacion: 'bodega', unidades: 40 }
    const { movimientos } = trasladarANevera('cerveza-a', 15, { bodega: 40, nevera: 0, total: 40 })
    const historial = [inicial, ...movimientos, ...movimientosInversos(movimientos)]
    expect(calcularStock(historial, 'cerveza-a')).toEqual({ bodega: 40, nevera: 0, total: 40 })
  })

  it('un movimiento de cero unidades da cero, no menos cero', () => {
    const cero: Movimiento[] = [{ productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: 0 }]
    expect(Object.is(movimientosInversos(cero)[0].unidades, 0)).toBe(true)
  })

  it('rechaza una lista vacía y unidades que no son enteras', () => {
    expect(() => movimientosInversos([])).toThrow()
    expect(() =>
      movimientosInversos([{ productoId: 'cerveza-a', tipo: 'venta', ubicacion: 'nevera', unidades: 1.5 }]),
    ).toThrow()
  })
})
