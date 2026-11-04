/**
 * Pruebas del formato de textos de la interfaz.
 *
 * Qué hace: verifica cómo se muestran el dinero y las fechas en pantalla.
 * Cómo lo hace: compara contra los textos exactos del diseño de Figma
 * ("$ 150.000", "Martes, 3 de noviembre", "28 oct – 3 nov").
 * Por qué: el formato debe ser igual en todas las pantallas y no depender de
 * la configuración regional del navegador ni de la zona horaria.
 */
import { describe, it, expect } from 'vitest'
import { diaSemanaCorto, fechaCompleta, fechaCorta, fechaLarga, fechaLocalIso, formatoPesos, horaLocal, rangoCorto } from './formato'

describe('formatoPesos', () => {
  it('agrupa los miles con punto y antepone el signo', () => {
    expect(formatoPesos(150000)).toBe('$ 150.000')
    expect(formatoPesos(980000)).toBe('$ 980.000')
    expect(formatoPesos(1234567)).toBe('$ 1.234.567')
  })
  it('maneja cero, cientos y negativos', () => {
    expect(formatoPesos(0)).toBe('$ 0')
    expect(formatoPesos(950)).toBe('$ 950')
    expect(formatoPesos(-65000)).toBe('-$ 65.000')
  })
  it('rechaza valores que no son enteros', () => {
    expect(() => formatoPesos(10.5)).toThrow()
  })
})

describe('fechas', () => {
  it('fechaLarga: día de la semana, número y mes', () => {
    expect(fechaLarga('2026-11-03')).toBe('Martes, 3 de noviembre')
    expect(fechaLarga('2026-01-01')).toBe('Jueves, 1 de enero')
  })
  it('fechaCorta: día/mes con dos dígitos', () => {
    expect(fechaCorta('2026-11-02')).toBe('02/11')
  })
  it('rangoCorto: abreviaturas de mes', () => {
    expect(rangoCorto('2026-10-28', '2026-11-03')).toBe('28 oct – 3 nov')
  })
  it('diaSemanaCorto: dos letras', () => {
    expect([ '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08' ].map(diaSemanaCorto))
      .toEqual(['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'])
  })
  it('rechaza fechas inválidas', () => {
    expect(() => fechaLarga('hoy')).toThrow()
  })
  it('fechaLocalIso usa el día local, no el UTC', () => {
    expect(fechaLocalIso(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03')
    expect(fechaLocalIso(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
})

describe('horaLocal', () => {
  it('da la hora y los minutos del reloj local con dos dígitos', () => {
    expect(horaLocal(new Date(2026, 10, 3, 16, 20).toISOString())).toBe('16:20')
    expect(horaLocal(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('09:05')
  })

  it('rechaza un instante inválido', () => {
    expect(() => horaLocal('ayer')).toThrow(/instante/i)
  })
})

describe('fechaCompleta', () => {
  it('da día/mes/año con dos dígitos', () => {
    expect(fechaCompleta('2026-11-03')).toBe('03/11/2026')
  })

  it('rechaza una fecha inválida', () => {
    expect(() => fechaCompleta('2026-13-40')).toThrow()
  })
})
