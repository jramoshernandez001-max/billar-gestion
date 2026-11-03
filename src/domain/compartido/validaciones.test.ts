/**
 * Pruebas de las validaciones compartidas del dominio.
 *
 * Qué hace: verifica que validarMonto acepte pesos enteros mayores o iguales
 * a cero y rechace todo lo demás con un mensaje que nombre el campo.
 * Cómo lo hace: prueba valores válidos y valores inválidos (negativos,
 * decimales y números no finitos) y revisa el mensaje del error.
 * Por qué: todos los módulos de dinero (ventas, cierres, deudas, utilidad)
 * dependen de esta regla; probarla una sola vez aquí garantiza que se
 * comporte igual en todos.
 */
import { describe, it, expect } from 'vitest'
import { validarMonto } from './validaciones'

describe('validarMonto', () => {
  it('acepta cero y enteros positivos', () => {
    expect(() => validarMonto('El monto', 0)).not.toThrow()
    expect(() => validarMonto('El monto', 114000)).not.toThrow()
  })

  it('rechaza montos negativos', () => {
    expect(() => validarMonto('El monto', -1)).toThrow()
  })

  it('rechaza montos con decimales', () => {
    expect(() => validarMonto('El monto', 2500.5)).toThrow()
  })

  it('rechaza valores que no son números finitos', () => {
    expect(() => validarMonto('El monto', Number.NaN)).toThrow()
    expect(() => validarMonto('El monto', Number.POSITIVE_INFINITY)).toThrow()
  })

  it('el mensaje de error nombra el campo inválido', () => {
    expect(() => validarMonto('El efectivo', -5)).toThrow(
      'El efectivo debe ser un entero mayor o igual a cero',
    )
  })
})