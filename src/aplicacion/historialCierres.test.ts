/**
 * Pruebas del historial de cierres.
 *
 * Qué hace: verifica el orden, el rango escrito, si está desactualizado y el
 * estado del cuadre de cada cierre.
 * Cómo lo hace: cierres inventados con resultados hechos a mano.
 * Por qué: la pantalla solo dibuja; saber qué cierre hay que recalcular es
 * lo que más importa del historial.
 */
import { describe, it, expect } from 'vitest'
import { resumirCierres } from './historialCierres'
import type { CierreLeido } from '../datos/cierres'

const cierre = (id: string, tipo: 'diario' | 'semanal', desde: string, hasta: string, diferencia: number): CierreLeido => ({
  id, tipo, desde, hasta, calculadoEn: `${hasta}T23:00:00.000Z`, efectivo: 40000, transferencias: 10000, dineroCorregidoEn: null, costosManuales: {}, costosUsados: [],
  resultado: tipo === 'diario'
    ? { dineroTotal: 50000, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: diferencia > 0 ? diferencia : 0 }
    : { completo: true, costoReposicion: 1, productosSinCosto: [], ventasSinCosto: 0, comprasUsadas: [], costosUsados: [], cuadre: { dineroTotal: 50000, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: diferencia > 0 ? diferencia : 0 }, utilidad: { utilidadEsperada: 1, utilidadReal: 1, diferencia: 0 } },
})

const cierres = [
  cierre('c1', 'diario', '2026-11-01', '2026-11-01', 0),
  cierre('c2', 'semanal', '2026-10-26', '2026-11-01', -4000),
  cierre('c3', 'diario', '2026-11-02', '2026-11-02', 2000),
]

describe('resumirCierres', () => {
  it('ordena del más reciente al más antiguo', () => {
    expect(resumirCierres(cierres, [], 'todos').map((c) => c.id)).toEqual(['c3', 'c1', 'c2'])
  })

  it('marca los desactualizados y los cuenta', () => {
    const r = resumirCierres(cierres, ['c1'], 'todos')
    expect(r.find((c) => c.id === 'c1')?.desactualizado).toBe(true)
    expect(r.find((c) => c.id === 'c3')?.desactualizado).toBe(false)
  })

  it('describe tipo, periodo y cuadre', () => {
    const r = resumirCierres(cierres, [], 'todos')
    expect(r.find((c) => c.id === 'c2')).toMatchObject({ tipo: 'semanal', titulo: 'Cierre semanal', estado: 'faltante', monto: 4000, dineroTotal: 50000 })
    expect(r.find((c) => c.id === 'c3')).toMatchObject({ titulo: 'Cierre diario', estado: 'sobrante', monto: 2000 })
  })

  it('filtra por tipo', () => {
    expect(resumirCierres(cierres, [], 'diario').map((c) => c.id)).toEqual(['c3', 'c1'])
    expect(resumirCierres(cierres, [], 'semanal').map((c) => c.id)).toEqual(['c2'])
  })
})
