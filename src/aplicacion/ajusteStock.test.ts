/**
 * Pruebas del cálculo de un ajuste de stock.
 *
 * Qué hace: verifica el stock que quedaría después de sumar o restar, las
 * unidades con signo que se mandan a la base y los problemas que impiden
 * guardar (unidades inválidas o motivo vacío).
 * Cómo lo hace: casos con números hechos a mano (stock actual de −2).
 * Por qué: el ajuste corrige el inventario con un conteo físico; un signo
 * mal puesto dejaría el stock peor que antes.
 */
import { describe, it, expect } from 'vitest'
import { calcularAjuste } from './ajusteStock'

describe('calcularAjuste', () => {
  const base = { actual: -2, tipo: 'sumar' as const, unidades: 6, motivo: 'Conteo físico' }

  it('sumar: el stock queda en actual + unidades y se manda con signo positivo', () => {
    expect(calcularAjuste(base)).toEqual({ despues: 4, unidadesConSigno: 6, problema: null, puedeGuardar: true })
  })

  it('restar: el stock queda en actual − unidades y se manda con signo negativo', () => {
    expect(calcularAjuste({ ...base, actual: 10, tipo: 'restar' })).toEqual({ despues: 4, unidadesConSigno: -6, problema: null, puedeGuardar: true })
  })

  it('sin unidades válidas muestra el stock actual y no deja guardar', () => {
    for (const unidades of [null, 0, -3, 1.5]) {
      const r = calcularAjuste({ ...base, unidades })
      expect(r).toMatchObject({ despues: -2, unidadesConSigno: null, puedeGuardar: false })
      expect(r.problema).toMatch(/unidades/i)
    }
  })

  it('sin motivo (o solo espacios) no deja guardar', () => {
    for (const motivo of ['', '   ']) {
      const r = calcularAjuste({ ...base, motivo })
      expect(r.puedeGuardar).toBe(false)
      expect(r.problema).toMatch(/motivo/i)
      expect(r.despues).toBe(4)
    }
  })
})
