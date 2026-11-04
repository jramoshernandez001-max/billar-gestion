/**
 * Pruebas de esErrorDeRed.
 *
 * Qué hace: verifica que se distinga un fallo de conexión de un error de la
 * base de datos.
 * Cómo lo hace: prueba mensajes típicos de fetch y errores con código de
 * Postgres.
 * Por qué: un fallo de red se guarda para reintentar; un error de la base
 * (por ejemplo "stock insuficiente") se muestra y no se reintenta.
 */
import { describe, expect, it } from 'vitest'
import { esErrorDeRed } from './errorDeRed'

describe('esErrorDeRed', () => {
  it.each([
    'TypeError: Failed to fetch',
    'TypeError: NetworkError when attempting to fetch resource.',
    'Load failed',
    'Network request failed',
  ])('reconoce "%s" como fallo de red', (message) => {
    expect(esErrorDeRed({ message })).toBe(true)
  })

  it('un error de la base con código no es de red', () => {
    expect(esErrorDeRed({ message: 'Failed to fetch algo', code: 'P0001' })).toBe(false)
    expect(esErrorDeRed({ message: 'La deuda no existe', code: 'P0001' })).toBe(false)
  })

  it('un mensaje de la base sin parecido a red no es de red', () => {
    expect(esErrorDeRed({ message: 'No autorizado' })).toBe(false)
  })

  it('una excepción TypeError de fetch es de red; otras no', () => {
    expect(esErrorDeRed(new TypeError('Failed to fetch'))).toBe(true)
    expect(esErrorDeRed(new Error('otra cosa'))).toBe(false)
    expect(esErrorDeRed('texto')).toBe(false)
  })
})
