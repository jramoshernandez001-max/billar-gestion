/**
 * Pruebas de los cruces entre cierres semanales.
 *
 * Qué hace: verifica que se rechace un periodo que comparte días con otro
 * cierre semanal y que los diarios no estorben.
 * Cómo lo hace: llama a validarSinCruceSemanal con cierres de ejemplo.
 * Por qué: dos cierres semanales no pueden contar las mismas ventas.
 */
import { describe, it, expect } from 'vitest'
import { validarSinCruceSemanal } from './crucesCierre'

const semanal = { tipo: 'semanal' as const, desde: '2026-11-10', hasta: '2026-11-16' }

describe('validarSinCruceSemanal', () => {
  it('acepta un periodo pegado pero sin días en común', () => {
    expect(() => validarSinCruceSemanal({ desde: '2026-11-17', hasta: '2026-11-23' }, [semanal])).not.toThrow()
  })

  it('rechaza un periodo que comparte un día y dice con cuál', () => {
    expect(() => validarSinCruceSemanal({ desde: '2026-11-16', hasta: '2026-11-22' }, [semanal]))
      .toThrow('El periodo se cruza con el cierre semanal del 2026-11-10 al 2026-11-16')
  })

  it('los cierres diarios no cuentan', () => {
    expect(() => validarSinCruceSemanal({ desde: '2026-11-10', hasta: '2026-11-16' }, [{ tipo: 'diario', desde: '2026-11-12', hasta: '2026-11-12' }])).not.toThrow()
  })
})
