/**
 * Pruebas del resumen de deudas.
 *
 * Qué hace: verifica el saldo, el estado (pendiente, pagada o anulada), los
 * abonos ordenados y el total pendiente de la pantalla de deudas.
 * Cómo lo hace: deudas y abonos inventados con números calculados a mano.
 * Por qué: la pantalla solo dibuja este resumen; el saldo mal calculado haría
 * cobrar de más o de menos a un cliente.
 */
import { describe, it, expect } from 'vitest'
import { resumirDeudas } from './resumenDeudas'
import type { Abono, Deuda } from '../domain/deudas/deudas'

const deuda = (id: string, cliente: string, fecha: string, monto: number, estado: Deuda['estado'] = 'vigente'): Deuda => ({
  id, cliente, fecha, monto, descripcion: 'Fiado de ejemplo', estado,
})
const abono = (id: string, deudaId: string, fecha: string, monto: number, estado: Abono['estado'] = 'vigente'): Abono => ({
  id, deudaId, fecha, monto, descripcion: 'Abono de ejemplo', estado,
})

describe('resumirDeudas', () => {
  const deudas = [
    deuda('d1', 'Ana', '2026-11-01', 50000),
    deuda('d2', 'Beto', '2026-11-02', 30000),
    deuda('d3', 'Caro', '2026-11-03', 20000, 'anulada'),
  ]
  const abonos = [
    abono('a2', 'd1', '2026-11-05', 10000),
    abono('a1', 'd1', '2026-11-04', 15000),
    abono('a3', 'd1', '2026-11-06', 5000, 'anulada'),
    abono('a4', 'd2', '2026-11-04', 30000),
  ]

  it('calcula saldo y estado de cada deuda', () => {
    const { filas } = resumirDeudas(deudas, abonos, '2026-11-10')
    expect(filas.map((f) => [f.deuda.id, f.saldo, f.estado])).toEqual([
      ['d1', 25000, 'pendiente'],
      ['d2', 0, 'pagada'],
      ['d3', 0, 'anulada'],
    ])
  })

  it('suma solo lo pendiente de las deudas vigentes', () => {
    expect(resumirDeudas(deudas, abonos, '2026-11-10').totalPendiente).toBe(25000)
  })

  it('entrega los abonos de cada deuda ordenados por fecha, incluidos los anulados', () => {
    const { filas } = resumirDeudas(deudas, abonos, '2026-11-10')
    expect(filas[0].abonos.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(filas[2].abonos).toEqual([])
  })

  it('respeta la fecha de corte: un abono posterior no cuenta', () => {
    const { filas, totalPendiente } = resumirDeudas(deudas, abonos, '2026-11-04')
    expect(filas[0].saldo).toBe(35000)
    expect(filas[1].estado).toBe('pagada')
    expect(totalPendiente).toBe(35000)
  })

  it('sin deudas todo es cero', () => {
    expect(resumirDeudas([], [], '2026-11-10')).toEqual({ filas: [], totalPendiente: 0 })
  })

  it('rechaza una fecha de corte inválida y abonos que superan la deuda', () => {
    expect(() => resumirDeudas(deudas, abonos, 'hoy')).toThrow()
    expect(() => resumirDeudas([deuda('x', 'Z', '2026-11-01', 100)], [abono('z', 'x', '2026-11-02', 200)], '2026-11-10')).toThrow()
  })
})
