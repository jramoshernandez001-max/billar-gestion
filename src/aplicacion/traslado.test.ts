/**
 * Pruebas de la evaluación de un traslado de bodega a nevera.
 *
 * Qué hace: verifica cuándo el traslado se puede registrar, cuánto falta en
 * bodega y cuál es el máximo disponible.
 * Cómo lo hace: casos con números hechos a mano (bodega de 18 unidades).
 * Por qué: el diseño bloquea pedir más de lo que hay en bodega para no dejar
 * la bodega en negativo sin querer; la base solo avisa, así que esta regla de
 * la pantalla debe estar probada.
 */
import { describe, it, expect } from 'vitest'
import { evaluarTraslado } from './traslado'

describe('evaluarTraslado', () => {
  it('sin cantidad todavía no se puede registrar y no hay aviso', () => {
    expect(evaluarTraslado(18, null)).toEqual({ estado: 'vacio', maximo: 18, faltan: 0, puedeRegistrar: false })
  })

  it('una cantidad que cabe en la bodega se puede registrar', () => {
    expect(evaluarTraslado(18, 6)).toEqual({ estado: 'ok', maximo: 18, faltan: 0, puedeRegistrar: true })
    expect(evaluarTraslado(18, 18).puedeRegistrar).toBe(true)
  })

  it('pedir más de lo que hay dice cuánto falta y bloquea', () => {
    expect(evaluarTraslado(18, 24)).toEqual({ estado: 'excede', maximo: 18, faltan: 6, puedeRegistrar: false })
  })

  it('con la bodega en cero o negativa el máximo es cero', () => {
    expect(evaluarTraslado(0, 3)).toMatchObject({ estado: 'excede', maximo: 0, faltan: 3 })
    expect(evaluarTraslado(-4, 3)).toMatchObject({ estado: 'excede', maximo: 0, faltan: 3 })
  })

  it('cero, negativos o decimales no son una cantidad válida', () => {
    for (const malo of [0, -1, 1.5, Number.NaN]) {
      expect(evaluarTraslado(18, malo)).toMatchObject({ estado: 'invalida', puedeRegistrar: false })
    }
  })
})
