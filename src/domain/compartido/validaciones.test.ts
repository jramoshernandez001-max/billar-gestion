/**
 * Pruebas de las validaciones compartidas del dominio.
 *
 * Qué hace: verifica que validarMonto acepte pesos enteros mayores o iguales
 * a cero, que validarFecha acepte solo fechas reales AAAA-MM-DD, y que ambas
 * rechacen todo lo demás con un mensaje que nombre el campo.
 * Cómo lo hace: prueba valores válidos y valores inválidos (negativos,
 * decimales y números no finitos) y revisa el mensaje del error.
 * Por qué: todos los módulos de dinero (ventas, cierres, deudas, utilidad)
 * dependen de esta regla; probarla una sola vez aquí garantiza que se
 * comporte igual en todos.
 */
import { describe, it, expect } from 'vitest'
import { validarFecha, validarFechaHoraIso, validarMonto } from './validaciones'

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

describe('validarFecha', () => {
  it('acepta fechas reales con formato AAAA-MM-DD', () => {
    expect(() => validarFecha('La fecha', '2026-01-31')).not.toThrow()
    expect(() => validarFecha('La fecha', '2028-02-29')).not.toThrow()
  })

  it('rechaza días que no existen', () => {
    expect(() => validarFecha('La fecha', '2026-02-30')).toThrow()
    expect(() => validarFecha('La fecha', '2026-13-01')).toThrow()
  })

  it('un mes inexistente da el mismo mensaje claro, no un error genérico', () => {
    expect(() => validarFecha('La fecha', '2026-13-01')).toThrow(
      'La fecha debe ser una fecha válida con formato AAAA-MM-DD',
    )
  })

  it('rechaza otros formatos', () => {
    expect(() => validarFecha('La fecha', '31/01/2026')).toThrow()
    expect(() => validarFecha('La fecha', '2026-1-5')).toThrow()
    expect(() => validarFecha('La fecha', '2026-01-31T10:00')).toThrow()
  })

  it('el mensaje de error nombra el campo inválido', () => {
    expect(() => validarFecha('La fecha de corte', 'mañana')).toThrow(
      'La fecha de corte debe ser una fecha válida con formato AAAA-MM-DD',
    )
  })
})

describe('validarFechaHoraIso', () => {
  it('acepta el formato exacto de toISOString en UTC', () => {
    expect(() => validarFechaHoraIso('El momento', '2026-03-12T20:00:00.000Z')).not.toThrow()
  })

  it('rechaza otros formatos o zonas horarias', () => {
    expect(() => validarFechaHoraIso('El momento', '2026-03-12 20:00')).toThrow()
    expect(() => validarFechaHoraIso('El momento', '2026-03-12T20:00:00Z')).toThrow()
    expect(() => validarFechaHoraIso('El momento', '2026-03-12T20:00:00.000-05:00')).toThrow()
  })

  it('rechaza momentos que no existen', () => {
    expect(() => validarFechaHoraIso('El momento', '2026-02-30T10:00:00.000Z')).toThrow()
    expect(() => validarFechaHoraIso('El momento', '2026-03-12T25:00:00.000Z')).toThrow()
  })

  it('el mensaje de error nombra el campo inválido', () => {
    expect(() => validarFechaHoraIso('El momento del cálculo', 'ayer')).toThrow(
      'El momento del cálculo debe ser una fecha y hora ISO en UTC',
    )
  })
})
