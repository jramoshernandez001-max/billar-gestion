/**
 * Pruebas de los cálculos de una compra y de la corrección de su costo.
 *
 * Qué hace: verifica unidades, costo por unidad, problemas que impiden
 * registrar, y la diferencia al corregir el costo.
 * Cómo lo hace: casos con números hechos a mano (2 cajas de 24 por $ 96.000).
 * Por qué: el costo por unidad es lo que se usa para la utilidad; un cálculo
 * equivocado cambiaría la ganancia que se muestra.
 */
import { describe, it, expect } from 'vitest'
import { calcularCompra, calcularCorreccionCosto } from './calculoCompra'

const cerveza = { unidadesPorCaja: 24, manejaSixpack: true }
const agua = { unidadesPorCaja: 12, manejaSixpack: false }

describe('calcularCompra de licor', () => {
  const licor = { unidadesPorCaja: 1, manejaSixpack: false, categoria: 'licor' as const }

  it('se compra por botella', () => {
    expect(calcularCompra({ producto: licor, presentacion: 'unidad', cantidad: 3, costoTotal: 90000 })).toMatchObject({
      unidades: 3, costoPorUnidad: 30000, puedeRegistrar: true, detalle: '3 unidades',
    })
  })

  it('no admite caja ni sixpack', () => {
    for (const presentacion of ['caja', 'sixpack'] as const) {
      const r = calcularCompra({ producto: licor, presentacion, cantidad: 1, costoTotal: 1000 })
      expect(r.puedeRegistrar).toBe(false)
      expect(r.problema).toMatch(/botella/i)
    }
  })
})

describe('calcularCompra', () => {
  it('calcula unidades y costo por unidad', () => {
    expect(calcularCompra({ producto: cerveza, presentacion: 'caja', cantidad: 2, costoTotal: 96000 })).toEqual({
      unidades: 48, costoPorUnidad: 2000, problema: null, puedeRegistrar: true, detalle: '2 cajas × 24 unidades',
    })
    expect(calcularCompra({ producto: cerveza, presentacion: 'sixpack', cantidad: 2, costoTotal: 24000 })).toMatchObject({ unidades: 12, costoPorUnidad: 2000 })
  })

  it('redondea el costo por unidad al peso más cercano', () => {
    expect(calcularCompra({ producto: cerveza, presentacion: 'unidad', cantidad: 3, costoTotal: 10000 }).costoPorUnidad).toBe(3333)
  })

  it('sin costo todavía no se puede registrar', () => {
    const r = calcularCompra({ producto: cerveza, presentacion: 'caja', cantidad: 2, costoTotal: null })
    expect(r).toMatchObject({ unidades: 48, costoPorUnidad: null, puedeRegistrar: false })
    expect(r.problema).toMatch(/costo/i)
  })

  it('cantidad inválida o sixpack en un producto que no lo maneja da un problema', () => {
    expect(calcularCompra({ producto: cerveza, presentacion: 'caja', cantidad: 0, costoTotal: 1000 }).puedeRegistrar).toBe(false)
    const r = calcularCompra({ producto: agua, presentacion: 'sixpack', cantidad: 1, costoTotal: 1000 })
    expect(r).toMatchObject({ unidades: 0, puedeRegistrar: false })
    expect(r.problema).toMatch(/sixpack/i)
  })

  it('describe la cuenta de unidades para el panel', () => {
    expect(calcularCompra({ producto: cerveza, presentacion: 'caja', cantidad: 2, costoTotal: 1 }).detalle).toBe('2 cajas × 24 unidades')
    expect(calcularCompra({ producto: cerveza, presentacion: 'sixpack', cantidad: 1, costoTotal: 1 }).detalle).toBe('1 sixpack × 6 unidades')
    expect(calcularCompra({ producto: cerveza, presentacion: 'unidad', cantidad: 3, costoTotal: 1 }).detalle).toBe('3 unidades')
  })

  it('sin producto no se puede registrar', () => {
    expect(calcularCompra({ producto: null, presentacion: 'caja', cantidad: 1, costoTotal: 1000 })).toMatchObject({ puedeRegistrar: false })
  })
})

describe('calcularCorreccionCosto', () => {
  it('calcula costo por unidad nuevo y diferencia', () => {
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: 100800 })).toEqual({
      costoPorUnidad: 2100, diferencia: 4800, problema: null, puedeGuardar: true,
    })
  })

  it('una diferencia negativa también es válida', () => {
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: 90000 })).toMatchObject({ diferencia: -6000, puedeGuardar: true })
  })

  it('sin valor, igual al actual o inválido no se puede guardar', () => {
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: null })).toMatchObject({ costoPorUnidad: null, diferencia: null, puedeGuardar: false })
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: 96000 })).toMatchObject({ puedeGuardar: false })
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: -5 })).toMatchObject({ puedeGuardar: false })
    expect(calcularCorreccionCosto({ unidades: 48, costoActual: 96000, costoNuevo: 10.5 })).toMatchObject({ puedeGuardar: false })
  })
})
