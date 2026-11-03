/**
 * Pruebas de cierres guardados, desactualizados y recalculados.
 *
 * Qué hace: verifica que un cierre guarde cuándo se calculó, que se detecte
 * cuando quedó desactualizado por una anulación o corrección posterior de
 * algo que usó, y que recalcularlo lo deje al día con registro en la
 * bitácora.
 * Cómo lo hace: arma cierres y cambios de ejemplo inventados, con momentos
 * antes y después del cálculo, y revisa el resultado.
 * Por qué: nada se borra, pero un cierre calculado antes de una corrección
 * muestra números viejos; hay que saber cuándo recalcularlo.
 */
import { describe, it, expect } from 'vitest'
import {
  estaDesactualizado,
  guardarCierre,
  recalcularCierre,
  type CambioRegistro,
  type CierreGuardado,
} from './actualizacionCierre'

const calculadoEn = new Date('2026-03-16T02:00:00.000Z')
const antesDelCalculo = '2026-03-15T23:00:00.000Z'
const despuesDelCalculo = '2026-03-17T15:00:00.000Z'

// Costos que usó el cierre semanal de ejemplo: A con la compra c1, B con
// la c2, y C se vendió sin compra (costo manual o sin costo).
const costoA = { productoId: 'cerveza-a', compra: { id: 'c1', fecha: '2026-03-05' } }
const costoB = { productoId: 'cerveza-b', compra: { id: 'c2', fecha: '2026-03-01' } }
const costoC = { productoId: 'cerveza-c', compra: null }

/** Cierre semanal de ejemplo: usó las compras c1 y c2. */
const semanal: CierreGuardado<{ total: number }> = guardarCierre({
  tipo: 'semanal',
  desde: '2026-03-09',
  hasta: '2026-03-15',
  momento: calculadoEn,
  costosUsados: [costoA, costoB, costoC],
  resultado: { total: 100 },
})

/** Crea un cambio de ejemplo; por defecto, una venta anulada en el periodo. */
const cambio = (cambios: Partial<CambioRegistro> = {}): CambioRegistro => ({
  tipoCambio: 'anulacion',
  registro: 'venta',
  id: 'v1',
  fecha: '2026-03-12',
  momento: despuesDelCalculo,
  ...cambios,
})

describe('guardarCierre', () => {
  it('guarda cuándo se calculó, en ISO UTC', () => {
    expect(semanal).toEqual({
      tipo: 'semanal',
      desde: '2026-03-09',
      hasta: '2026-03-15',
      calculadoEn: '2026-03-16T02:00:00.000Z',
      costosUsados: [costoA, costoB, costoC],
      resultado: { total: 100 },
    })
  })

  it('un cierre diario es de un solo día', () => {
    expect(() =>
      guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-13', momento: calculadoEn, costosUsados: [], resultado: {} }),
    ).toThrow(/un solo día/i)
  })

  it('un cierre semanal va de lunes a domingo', () => {
    expect(() =>
      guardarCierre({ tipo: 'semanal', desde: '2026-03-10', hasta: '2026-03-16', momento: calculadoEn, costosUsados: [], resultado: {} }),
    ).toThrow(/lunes/i)
  })

  it('rechaza un momento de cálculo inválido', () => {
    expect(() =>
      guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: new Date('x'), costosUsados: [], resultado: {} }),
    ).toThrow(/cálculo/i)
  })
})

describe('estaDesactualizado', () => {
  it('sin cambios, está al día', () => {
    expect(estaDesactualizado(semanal, [])).toBe(false)
  })

  it('una venta, deuda o abono del periodo anulados después lo desactualizan', () => {
    for (const registro of ['venta', 'deuda', 'abono'] as const) {
      expect(estaDesactualizado(semanal, [cambio({ registro })])).toBe(true)
    }
  })

  it('un cambio hecho antes del cálculo no lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [cambio({ momento: antesDelCalculo })])).toBe(false)
  })

  it('un cambio de algo fuera del periodo no lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [cambio({ fecha: '2026-03-08' })])).toBe(false)
    expect(estaDesactualizado(semanal, [cambio({ fecha: '2026-03-16' })])).toBe(false)
  })

  it('anular o corregir el costo de una compra que usó lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [cambio({ registro: 'compra', id: 'c1', fecha: '2026-03-01' })])).toBe(true)
    expect(
      estaDesactualizado(semanal, [cambio({ tipoCambio: 'correccion-costo', registro: 'compra', id: 'c2', fecha: '2026-03-01' })]),
    ).toBe(true)
  })

  it('anular o corregir una compra que no usó no lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [cambio({ registro: 'compra', id: 'c9', fecha: '2026-03-12' })])).toBe(false)
    expect(
      estaDesactualizado(semanal, [cambio({ tipoCambio: 'correccion-costo', registro: 'compra', id: 'c9', fecha: '2026-03-12' })]),
    ).toBe(false)
  })

  it('un cierre diario solo mira su día', () => {
    const diario = guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: calculadoEn, costosUsados: [], resultado: {} })
    expect(estaDesactualizado(diario, [cambio({ fecha: '2026-03-12' })])).toBe(true)
    expect(estaDesactualizado(diario, [cambio({ fecha: '2026-03-11' })])).toBe(false)
  })

  it('rechaza una corrección de costo que no es de una compra', () => {
    expect(() => estaDesactualizado(semanal, [cambio({ tipoCambio: 'correccion-costo', registro: 'venta' })])).toThrow(/compra/i)
  })

  it('rechaza cambios con fecha o momento inválidos', () => {
    expect(() => estaDesactualizado(semanal, [cambio({ fecha: '2026-02-30' })])).toThrow()
    expect(() => estaDesactualizado(semanal, [cambio({ momento: '2026-03-17 15:00' })])).toThrow()
  })
})

describe('estaDesactualizado con registros nuevos', () => {
  /** Crea un registro nuevo de ejemplo; por defecto, una venta en el periodo. */
  const nuevo = (cambios: Partial<CambioRegistro> = {}): CambioRegistro =>
    cambio({ tipoCambio: 'registro-nuevo', id: 'n1', ...cambios })

  it('una venta, deuda o abono nuevos con fecha en el periodo lo desactualizan', () => {
    for (const registro of ['venta', 'deuda', 'abono'] as const) {
      expect(estaDesactualizado(semanal, [nuevo({ registro })])).toBe(true)
    }
  })

  it('un registro nuevo registrado antes del cálculo no lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [nuevo({ momento: antesDelCalculo })])).toBe(false)
  })

  it('un registro nuevo con fecha fuera del periodo no lo desactualiza', () => {
    expect(estaDesactualizado(semanal, [nuevo({ fecha: '2026-03-16' })])).toBe(false)
  })

  it('una compra nueva igual o posterior a la que usó, hasta el domingo, lo desactualiza', () => {
    const compraNueva = { registro: 'compra' as const, productoId: 'cerveza-a' }
    expect(estaDesactualizado(semanal, [nuevo({ ...compraNueva, fecha: '2026-03-07' })])).toBe(true)
    // Misma fecha: la nueva se registró después, así que pasa a ser la última.
    expect(estaDesactualizado(semanal, [nuevo({ ...compraNueva, fecha: '2026-03-05' })])).toBe(true)
  })

  it('una compra nueva anterior a la que usó, o después del domingo, no lo desactualiza', () => {
    const compraNueva = { registro: 'compra' as const, productoId: 'cerveza-a' }
    expect(estaDesactualizado(semanal, [nuevo({ ...compraNueva, fecha: '2026-03-04' })])).toBe(false)
    expect(estaDesactualizado(semanal, [nuevo({ ...compraNueva, fecha: '2026-03-16' })])).toBe(false)
  })

  it('una compra nueva de un producto que se vendió sin compra lo desactualiza', () => {
    expect(
      estaDesactualizado(semanal, [nuevo({ registro: 'compra', productoId: 'cerveza-c', fecha: '2026-02-20' })]),
    ).toBe(true)
  })

  it('una compra nueva de un producto que el cierre no vendió no lo desactualiza', () => {
    expect(
      estaDesactualizado(semanal, [nuevo({ registro: 'compra', productoId: 'cerveza-z', fecha: '2026-03-12' })]),
    ).toBe(false)
  })

  it('una compra nueva no desactualiza un cierre diario, que no usa costos', () => {
    const diario = guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: calculadoEn, costosUsados: [], resultado: {} })
    expect(
      estaDesactualizado(diario, [nuevo({ registro: 'compra', productoId: 'cerveza-a', fecha: '2026-03-12' })]),
    ).toBe(false)
  })

  it('rechaza una compra nueva sin producto', () => {
    expect(() => estaDesactualizado(semanal, [nuevo({ registro: 'compra', fecha: '2026-03-07' })])).toThrow(/producto/i)
  })
})

describe('recalcularCierre', () => {
  const momento = new Date('2026-03-18T01:00:00.000Z')

  it('deja el cierre al día con el resultado nuevo', () => {
    const { cierre } = recalcularCierre({ anterior: semanal, resultado: { total: 90 }, costosUsados: [costoA], usuario: 'a@example.com', momento })
    expect(cierre).toEqual({ ...semanal, calculadoEn: '2026-03-18T01:00:00.000Z', costosUsados: [costoA], resultado: { total: 90 } })
    // El cambio que lo había desactualizado ya quedó antes del nuevo cálculo.
    expect(estaDesactualizado(cierre, [cambio()])).toBe(false)
  })

  it('queda en la bitácora con el cierre de antes y el de después', () => {
    const { cierre, registro } = recalcularCierre({ anterior: semanal, resultado: { total: 90 }, costosUsados: [costoA], usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-18T01:00:00.000Z',
      accion: 'recalcular-cierre-semanal',
      antes: semanal,
      despues: cierre,
    })
  })

  it('un cierre diario usa la acción de recálculo diario', () => {
    const diario = guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: calculadoEn, costosUsados: [], resultado: { total: 1 } })
    const { registro } = recalcularCierre({ anterior: diario, resultado: { total: 2 }, costosUsados: [], usuario: 'a@example.com', momento })
    expect(registro.accion).toBe('recalcular-cierre-diario')
  })
})
