/**
 * Pruebas de la lista y el detalle de deudas.
 *
 * Qué hace: verifica filtro por estado (pendientes, pagadas, anuladas),
 * búsqueda por cliente, orden, total pendiente y detalle con abonos.
 * Cómo lo hace: deudas y abonos inventados con saldos hechos a mano.
 * Por qué: el saldo no se guarda; se calcula, y la pantalla solo lo dibuja.
 */
import { describe, it, expect } from 'vitest'
import { detalleDeuda, listarDeudasPorEstado } from './listaDeudas'
import type { Abono, Deuda } from '../domain/deudas/deudas'

const deuda = (id: string, cliente: string, fecha: string, monto: number, estado: Deuda['estado'] = 'vigente'): Deuda => ({ id, cliente, fecha, monto, descripcion: 'Fiado', estado })
const abono = (id: string, deudaId: string, fecha: string, monto: number, estado: Abono['estado'] = 'vigente'): Abono => ({ id, deudaId, fecha, monto, descripcion: 'Pagó', estado })

const deudas = [
  deuda('d1', 'Ana', '2026-11-01', 50000),
  deuda('d2', 'Beto', '2026-11-02', 15000),
  deuda('d3', 'Caro', '2026-10-30', 9000),
  deuda('d4', 'Dani', '2026-10-29', 7000, 'anulada'),
]
const abonos = [abono('a1', 'd1', '2026-11-02', 20000), abono('a2', 'd3', '2026-11-01', 9000), abono('a3', 'd2', '2026-11-02', 5000, 'anulada')]
const hoy = '2026-11-03'

describe('listarDeudasPorEstado', () => {
  it('pendientes: con saldo, más recientes primero, y total', () => {
    const r = listarDeudasPorEstado({ deudas, abonos, hoy, estado: 'pendiente', busqueda: '' })
    expect(r.filas.map((f) => [f.id, f.saldo, f.abonado])).toEqual([['d2', 15000, 0], ['d1', 30000, 20000]])
    expect(r.total).toBe(45000)
    expect(r.cuentas).toBe(2)
  })

  it('pagadas y anuladas', () => {
    expect(listarDeudasPorEstado({ deudas, abonos, hoy, estado: 'pagada', busqueda: '' }).filas.map((f) => f.id)).toEqual(['d3'])
    expect(listarDeudasPorEstado({ deudas, abonos, hoy, estado: 'anulada', busqueda: '' }).filas.map((f) => f.id)).toEqual(['d4'])
  })

  it('busca por cliente sin importar mayúsculas ni tildes', () => {
    expect(listarDeudasPorEstado({ deudas, abonos, hoy, estado: 'pendiente', busqueda: ' ANA ' }).filas.map((f) => f.id)).toEqual(['d1'])
  })

  it('cuenta cuántas hay de cada estado', () => {
    const r = listarDeudasPorEstado({ deudas, abonos, hoy, estado: 'pendiente', busqueda: '' })
    expect(r.conteo).toEqual({ pendiente: 2, pagada: 1, anulada: 1 })
  })
})

describe('detalleDeuda', () => {
  it('devuelve la deuda con saldo, abonado y abonos (con su estado)', () => {
    const d = detalleDeuda({ deudas, abonos, hoy, deudaId: 'd2', anulaciones: new Map() })
    expect(d).toMatchObject({ id: 'd2', cliente: 'Beto', monto: 15000, saldo: 15000, abonado: 0, estado: 'pendiente', puedeAnular: true, puedeAbonar: true })
    expect(d?.abonos.map((a) => [a.id, a.estado])).toEqual([['a3', 'anulada']])
  })

  it('una deuda con abonos vigentes no se puede anular; una pagada no recibe abonos', () => {
    expect(detalleDeuda({ deudas, abonos, hoy, deudaId: 'd1', anulaciones: new Map() })).toMatchObject({ puedeAnular: false, puedeAbonar: true })
    expect(detalleDeuda({ deudas, abonos, hoy, deudaId: 'd3', anulaciones: new Map() })).toMatchObject({ estado: 'pagada', puedeAbonar: false, puedeAnular: false })
  })

  it('una deuda anulada no tiene acciones y muestra su motivo', () => {
    const d = detalleDeuda({ deudas, abonos, hoy, deudaId: 'd4', anulaciones: new Map([['d4', { motivo: 'error', fecha: '2026-10-30' }]]) })
    expect(d).toMatchObject({ estado: 'anulada', puedeAnular: false, puedeAbonar: false, anulacion: { motivo: 'error', fecha: '2026-10-30' } })
  })

  it('devuelve null si no existe', () => {
    expect(detalleDeuda({ deudas, abonos, hoy, deudaId: 'x', anulaciones: new Map() })).toBeNull()
  })
})
