/**
 * Pruebas de la descripción de deudas y abonos.
 *
 * Qué hace: verifica que la descripción se limpie de espacios a los lados,
 * que no quede vacía y que no pase de 200 caracteres.
 * Cómo lo hace: prueba textos válidos, vacíos, con espacios y largos, con
 * tildes y emojis para contar caracteres como los ve una persona.
 * Por qué: cada deuda y cada abono deben justificar el movimiento; una
 * descripción vacía no explica nada.
 */
import { describe, it, expect } from 'vitest'
import { MAXIMO_DESCRIPCION, normalizarDescripcion, validarDescripcion } from './descripcion'

describe('normalizarDescripcion', () => {
  it('quita los espacios a los lados', () => {
    expect(normalizarDescripcion('  Dos cervezas fiadas ')).toBe('Dos cervezas fiadas')
  })

  it('rechaza un texto vacío o solo con espacios', () => {
    expect(() => normalizarDescripcion('')).toThrow(/descripción/i)
    expect(() => normalizarDescripcion('    ')).toThrow(/descripción/i)
  })

  it('acepta hasta 200 caracteres y rechaza más', () => {
    expect(MAXIMO_DESCRIPCION).toBe(200)
    expect(normalizarDescripcion('á'.repeat(200))).toHaveLength(200)
    expect(() => normalizarDescripcion('á'.repeat(201))).toThrow(/200/)
  })

  it('cuenta un emoji como un solo carácter', () => {
    expect(() => normalizarDescripcion('🍺'.repeat(200))).not.toThrow()
  })

  it('los espacios de los lados no cuentan para el máximo', () => {
    expect(() => normalizarDescripcion(`  ${'a'.repeat(200)}  `)).not.toThrow()
  })
})

describe('validarDescripcion', () => {
  it('acepta una descripción ya limpia', () => {
    expect(() => validarDescripcion('La descripción', 'Abono en efectivo')).not.toThrow()
  })

  it('rechaza una descripción con espacios sobrantes a los lados', () => {
    expect(() => validarDescripcion('La descripción', ' Abono')).toThrow(/espacios/i)
    expect(() => validarDescripcion('La descripción', 'Abono ')).toThrow(/espacios/i)
  })

  it('rechaza una descripción vacía o de más de 200 caracteres', () => {
    expect(() => validarDescripcion('La descripción', '')).toThrow()
    expect(() => validarDescripcion('La descripción', 'a'.repeat(201))).toThrow(/200/)
  })

  it('el mensaje nombra el campo inválido', () => {
    expect(() => validarDescripcion('La descripción del abono', '')).toThrow(/del abono/)
  })
})
