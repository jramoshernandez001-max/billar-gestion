/**
 * Pruebas de la validación de la semana del cierre.
 *
 * Qué hace: verifica que una semana de cierre vaya de un lunes al domingo
 * siguiente (exactamente 7 días) y que se rechace cualquier otro periodo.
 * Cómo lo hace: prueba semanas válidas (incluso las que cruzan de mes y de
 * año) y periodos inválidos, y revisa el cálculo de sumar días.
 * Por qué: el cierre semanal y su utilidad solo son comparables entre sí si
 * todas las semanas cubren los mismos días.
 */
import { describe, it, expect } from 'vitest'
import { diaDeLaSemana, sumarDias, validarSemana } from './semana'

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

describe('validarSemana', () => {
  it('acepta de lunes al domingo siguiente', () => {
    expect(() => validarSemana('2026-03-09', '2026-03-15')).not.toThrow()
    expect(() => validarSemana('2026-12-28', '2027-01-03')).not.toThrow()
  })

  it('rechaza una semana que no empieza en lunes', () => {
    expect(() => validarSemana('2026-03-10', '2026-03-16')).toThrow(/lunes/i)
  })

  it('rechaza un fin que no es el domingo siguiente', () => {
    expect(() => validarSemana('2026-03-09', '2026-03-14')).toThrow(/domingo/i)
    expect(() => validarSemana('2026-03-09', '2026-03-22')).toThrow(/domingo/i)
    expect(() => validarSemana('2026-03-09', '2026-03-08')).toThrow(/domingo/i)
  })

  it('rechaza fechas inválidas', () => {
    expect(() => validarSemana('2026-02-30', '2026-03-08')).toThrow(/fecha/i)
    expect(() => validarSemana('2026-03-09', 'domingo')).toThrow(/fecha/i)
  })
})
