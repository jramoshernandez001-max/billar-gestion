/**
 * Pruebas de la venta con estado.
 *
 * Qué hace: verifica que de una lista de ventas se tomen solo los renglones
 * de las ventas vigentes.
 * Cómo lo hace: arma ventas de ejemplo inventadas, vigentes y anuladas, y
 * revisa los renglones que quedan.
 * Por qué: una venta anulada no se borra, pero ya no debe sumar en ningún
 * cierre.
 */
import { describe, it, expect } from 'vitest'
import type { RenglonVenta } from './movimientosVenta'
import { renglonesParaRegistrar, renglonesVigentes, type Venta } from './venta'

const cervezaA = { unidadesPorCaja: 20, manejaSixpack: false, precioUnidad: 2000, precioCaja: 38000 }
const r1: RenglonVenta = { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 2 }
const r2: RenglonVenta = { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1 }
const r3: RenglonVenta = { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 5 }

/** Crea una venta de ejemplo. */
const venta = (id: string, estado: Venta['estado'], renglones: RenglonVenta[]): Venta => ({
  id,
  fecha: '2026-03-12',
  estado,
  renglones,
})

describe('renglonesVigentes', () => {
  it('junta los renglones de las ventas vigentes, en orden', () => {
    expect(renglonesVigentes([venta('v1', 'vigente', [r1]), venta('v2', 'vigente', [r2, r3])])).toEqual([r1, r2, r3])
  })

  it('deja por fuera los renglones de las ventas anuladas', () => {
    expect(renglonesVigentes([venta('v1', 'anulada', [r1]), venta('v2', 'vigente', [r2])])).toEqual([r2])
  })

  it('sin ventas no hay renglones', () => {
    expect(renglonesVigentes([])).toEqual([])
  })

  it('rechaza un estado desconocido', () => {
    expect(() => renglonesVigentes([venta('v1', 'borrada' as Venta['estado'], [r1])])).toThrow(/estado/i)
  })
})

describe('renglonesParaRegistrar', () => {
  const cero: RenglonVenta = { ...r1, cantidad: 0 }

  it('deja los renglones con cantidad y quita los de cantidad cero', () => {
    expect(renglonesParaRegistrar([r1, cero, r2])).toEqual([r1, r2])
  })

  it('sin renglones de cero, los deja todos', () => {
    expect(renglonesParaRegistrar([r1, r2])).toEqual([r1, r2])
  })

  it('si todos los renglones son cero, lanza un error claro', () => {
    expect(() => renglonesParaRegistrar([cero, cero])).toThrow(/todos los renglones/i)
  })

  it('una venta sin renglones tampoco se puede registrar', () => {
    expect(() => renglonesParaRegistrar([])).toThrow(/renglones/i)
  })

  it('rechaza cantidades negativas o con decimales', () => {
    expect(() => renglonesParaRegistrar([{ ...r1, cantidad: -1 }])).toThrow()
    expect(() => renglonesParaRegistrar([{ ...r1, cantidad: 1.5 }])).toThrow()
  })
})
