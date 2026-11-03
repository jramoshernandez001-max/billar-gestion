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

/** Cierre semanal de ejemplo: usó las compras c1 y c2. */
const semanal: CierreGuardado<{ total: number }> = guardarCierre({
  tipo: 'semanal',
  desde: '2026-03-09',
  hasta: '2026-03-15',
  momento: calculadoEn,
  comprasUsadas: ['c1', 'c2'],
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
      comprasUsadas: ['c1', 'c2'],
      resultado: { total: 100 },
    })
  })

  it('un cierre diario es de un solo día', () => {
    expect(() =>
      guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-13', momento: calculadoEn, comprasUsadas: [], resultado: {} }),
    ).toThrow(/un solo día/i)
  })

  it('un cierre semanal va de lunes a domingo', () => {
    expect(() =>
      guardarCierre({ tipo: 'semanal', desde: '2026-03-10', hasta: '2026-03-16', momento: calculadoEn, comprasUsadas: [], resultado: {} }),
    ).toThrow(/lunes/i)
  })

  it('rechaza un momento de cálculo inválido', () => {
    expect(() =>
      guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: new Date('x'), comprasUsadas: [], resultado: {} }),
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
    const diario = guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: calculadoEn, comprasUsadas: [], resultado: {} })
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

describe('recalcularCierre', () => {
  const momento = new Date('2026-03-18T01:00:00.000Z')

  it('deja el cierre al día con el resultado nuevo', () => {
    const { cierre } = recalcularCierre({ anterior: semanal, resultado: { total: 90 }, comprasUsadas: ['c1'], usuario: 'a@example.com', momento })
    expect(cierre).toEqual({ ...semanal, calculadoEn: '2026-03-18T01:00:00.000Z', comprasUsadas: ['c1'], resultado: { total: 90 } })
    // El cambio que lo había desactualizado ya quedó antes del nuevo cálculo.
    expect(estaDesactualizado(cierre, [cambio()])).toBe(false)
  })

  it('queda en la bitácora con el cierre de antes y el de después', () => {
    const { cierre, registro } = recalcularCierre({ anterior: semanal, resultado: { total: 90 }, comprasUsadas: ['c1'], usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-18T01:00:00.000Z',
      accion: 'recalcular-cierre-semanal',
      antes: semanal,
      despues: cierre,
    })
  })

  it('un cierre diario usa la acción de recálculo diario', () => {
    const diario = guardarCierre({ tipo: 'diario', desde: '2026-03-12', hasta: '2026-03-12', momento: calculadoEn, comprasUsadas: [], resultado: { total: 1 } })
    const { registro } = recalcularCierre({ anterior: diario, resultado: { total: 2 }, comprasUsadas: [], usuario: 'a@example.com', momento })
    expect(registro.accion).toBe('recalcular-cierre-diario')
  })
})
