/**
 * Pruebas de la validación de la semana del cierre.
 *
 * Qué hace: verifica el periodo libre del cierre semanal, la semana que se
 * propone por defecto (martes a lunes) y cuándo dos periodos se cruzan.
 * Cómo lo hace: prueba rangos válidos e inválidos, días de la semana que
 * cruzan de mes y de año, y el cálculo de sumar días.
 * Por qué: el negocio cierra la semana el martes y a veces necesita cerrar
 * otro rango; dos cierres semanales no deben contar los mismos días.
 */
import { describe, it, expect } from 'vitest'
import { diaDeLaSemana, periodosSeCruzan, semanaPorDefecto, sumarDias, validarPeriodoSemanal } from './semana'

describe('sumarDias', () => {
  it('suma días dentro del mes, cruzando de mes y de año', () => {
    expect(sumarDias('2026-03-09', 6)).toBe('2026-03-15')
    expect(sumarDias('2026-03-30', 6)).toBe('2026-04-05')
    expect(sumarDias('2026-12-28', 6)).toBe('2027-01-03')
  })

  it('tiene en cuenta los años bisiestos', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('rechaza una fecha inválida o días que no son enteros', () => {
    expect(() => sumarDias('2026-02-30', 1)).toThrow()
    expect(() => sumarDias('2026-03-09', 1.5)).toThrow()
  })
})

describe('diaDeLaSemana', () => {
  it('devuelve 1 para lunes y 7 para domingo', () => {
    expect(diaDeLaSemana('2026-03-09')).toBe(1)
    expect(diaDeLaSemana('2026-03-15')).toBe(7)
    expect(diaDeLaSemana('2026-03-12')).toBe(4)
  })
})

describe('validarPeriodoSemanal', () => {
  it('acepta cualquier rango de uno o más días, en cualquier día de la semana', () => {
    expect(() => validarPeriodoSemanal('2026-11-10', '2026-11-16')).not.toThrow()
    expect(() => validarPeriodoSemanal('2026-11-10', '2026-11-10')).not.toThrow()
    expect(() => validarPeriodoSemanal('2026-12-29', '2027-01-12')).not.toThrow()
  })

  it('rechaza un fin anterior al inicio', () => {
    expect(() => validarPeriodoSemanal('2026-11-16', '2026-11-10')).toThrow(/anterior/i)
  })

  it('rechaza fechas inválidas', () => {
    expect(() => validarPeriodoSemanal('2026-02-30', '2026-03-08')).toThrow(/fecha/i)
    expect(() => validarPeriodoSemanal('2026-03-09', 'lunes')).toThrow(/fecha/i)
  })
})

describe('semanaPorDefecto', () => {
  it('propone la última semana completa de martes a lunes', () => {
    // Miércoles 18 de noviembre de 2026 → martes 10 a lunes 16.
    expect(semanaPorDefecto('2026-11-18')).toEqual({ desde: '2026-11-10', hasta: '2026-11-16' })
  })

  it('el martes propone la semana que terminó ayer', () => {
    expect(semanaPorDefecto('2026-11-17')).toEqual({ desde: '2026-11-10', hasta: '2026-11-16' })
  })

  it('el lunes la semana todavía no termina: propone la anterior', () => {
    expect(semanaPorDefecto('2026-11-16')).toEqual({ desde: '2026-11-03', hasta: '2026-11-09' })
  })

  it('cruza de mes y de año', () => {
    expect(semanaPorDefecto('2027-01-01')).toEqual({ desde: '2026-12-22', hasta: '2026-12-28' })
  })
})

describe('periodosSeCruzan', () => {
  it('se cruzan si comparten al menos un día', () => {
    expect(periodosSeCruzan({ desde: '2026-11-10', hasta: '2026-11-16' }, { desde: '2026-11-16', hasta: '2026-11-22' })).toBe(true)
    expect(periodosSeCruzan({ desde: '2026-11-10', hasta: '2026-11-16' }, { desde: '2026-11-12', hasta: '2026-11-13' })).toBe(true)
  })

  it('no se cruzan si uno termina antes de que empiece el otro', () => {
    expect(periodosSeCruzan({ desde: '2026-11-10', hasta: '2026-11-16' }, { desde: '2026-11-17', hasta: '2026-11-23' })).toBe(false)
    expect(periodosSeCruzan({ desde: '2026-11-17', hasta: '2026-11-23' }, { desde: '2026-11-10', hasta: '2026-11-16' })).toBe(false)
  })
})
