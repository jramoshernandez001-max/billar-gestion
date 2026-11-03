/**
 * Pruebas del cálculo de stock a partir de movimientos.
 *
 * Qué hace: verifica que el stock de un producto en bodega, en nevera y en
 * total salga de sumar sus movimientos.
 * Cómo lo hace: arma listas de movimientos de ejemplo (compras, traslados y
 * ventas) y compara el resultado de calcularStock con lo esperado.
 * Por qué: el inventario nunca se edita a mano; si esta suma falla, todo el
 * inventario y los cierres quedan mal.
 */
import { describe, it, expect } from 'vitest'
import { calcularStock, type Movimiento } from './stock'

/** Crea un movimiento de ejemplo; por defecto es de Costeñita. */
const mov = (
  tipo: Movimiento['tipo'],
  ubicacion: Movimiento['ubicacion'],
  unidades: number,
  productoId = 'costenita',
): Movimiento => ({ productoId, tipo, ubicacion, unidades })

describe('calcularStock', () => {
  it('sin movimientos el stock es cero', () => {
    expect(calcularStock([], 'costenita')).toEqual({
      bodega: 0,
      nevera: 0,
      total: 0,
    })
  })

  it('una compra suma a la bodega', () => {
    const movimientos = [mov('compra', 'bodega', 100)]
    expect(calcularStock(movimientos, 'costenita')).toEqual({
      bodega: 100,
      nevera: 0,
      total: 100,
    })
  })

  it('un traslado mueve de bodega a nevera sin cambiar el total', () => {
    const movimientos = [
      mov('compra', 'bodega', 100),
      mov('traslado', 'bodega', -40),
      mov('traslado', 'nevera', 40),
    ]
    expect(calcularStock(movimientos, 'costenita')).toEqual({
      bodega: 60,
      nevera: 40,
      total: 100,
    })
  })

  it('una venta resta de la nevera', () => {
    const movimientos = [
      mov('compra', 'bodega', 100),
      mov('traslado', 'bodega', -40),
      mov('traslado', 'nevera', 40),
      mov('venta', 'nevera', -10),
    ]
    expect(calcularStock(movimientos, 'costenita')).toEqual({
      bodega: 60,
      nevera: 30,
      total: 90,
    })
  })

  it('ignora los movimientos de otros productos', () => {
    const movimientos = [
      mov('compra', 'bodega', 100),
      mov('compra', 'bodega', 999, 'aguila'),
    ]
    expect(calcularStock(movimientos, 'costenita').total).toBe(100)
  })

  it('compra 20 cajas y vende 15: el inventario general sube 5 cajas', () => {
    // Costeñita: caja x38. 20 cajas = 760 unidades y 15 cajas = 570 unidades.
    const movimientos = [
      mov('compra', 'bodega', 760),
      mov('traslado', 'bodega', -570),
      mov('traslado', 'nevera', 570),
      mov('venta', 'nevera', -570),
    ]
    // Quedan 190 unidades, que son 5 cajas de 38.
    expect(calcularStock(movimientos, 'costenita')).toEqual({
      bodega: 190,
      nevera: 0,
      total: 190,
    })
  })

  it('rechaza movimientos con unidades que no son enteras', () => {
    const movimientos = [mov('compra', 'bodega', 1.5)]
    expect(() => calcularStock(movimientos, 'costenita')).toThrow()
  })
})