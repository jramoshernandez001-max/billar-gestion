/**
 * Pruebas de la descripción de deudas y abonos.
 *
 * Qué hace: verifica que la descripción se limpie de espacios a los lados,
 * que los espacios repetidos en medio queden en uno, que no quede vacía y
 * que no pase de 200 caracteres.
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

  it('reduce a uno los espacios repetidos en medio', () => {
    expect(normalizarDescripcion('Dos   cervezas  fiadas')).toBe('Dos cervezas fiadas')
    expect(normalizarDescripcion('  Abono    parcial  ')).toBe('Abono parcial')
  })

  it('convierte tabulaciones y saltos de línea en un solo espacio', () => {
    expect(normalizarDescripcion('Dos\tcervezas\nfiadas')).toBe('Dos cervezas fiadas')
    expect(normalizarDescripcion('Abono \r\n  parcial')).toBe('Abono parcial')
  })

  it('los espacios repetidos que se quitan no cuentan para el máximo', () => {
    const conEspacios = `${'a'.repeat(100)}     ${'b'.repeat(99)}`
    expect(normalizarDescripcion(conEspacios)).toHaveLength(200)
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

  it('rechaza una descripción con espacios repetidos en medio', () => {
    expect(() => validarDescripcion('La descripción', 'Abono  parcial')).toThrow(/espacios/i)
  })

  it('rechaza una descripción con tabulaciones o saltos de línea en medio', () => {
    expect(() => validarDescripcion('La descripción', 'Abono\tparcial')).toThrow(/tabulaciones|saltos/i)
    expect(() => validarDescripcion('La descripción', 'Abono\nparcial')).toThrow(/tabulaciones|saltos/i)
  })

  it('rechaza una descripción vacía o de más de 200 caracteres', () => {
    expect(() => validarDescripcion('La descripción', '')).toThrow()
    expect(() => validarDescripcion('La descripción', 'a'.repeat(201))).toThrow(/200/)
  })

  it('el mensaje nombra el campo inválido', () => {
    expect(() => validarDescripcion('La descripción del abono', '')).toThrow(/del abono/)
  })
})
