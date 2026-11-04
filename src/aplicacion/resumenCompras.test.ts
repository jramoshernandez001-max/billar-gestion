/**
 * Pruebas del historial de compras.
 *
 * Qué hace: verifica el periodo, el filtro por estado, la numeración C-n, el
 * texto de cantidad, el costo por unidad y el motivo de las anuladas.
 * Cómo lo hace: compras inventadas con números hechos a mano.
 * Por qué: la pantalla solo dibuja este resumen; un costo mal mostrado
 * llevaría a corregir lo que estaba bien.
 */
import { describe, it, expect } from 'vitest'
import { periodoDeCompras, resumirCompras } from './resumenCompras'
import type { Compra } from '../domain/inventario/compras'

const cerveza = { unidadesPorCaja: 24, manejaSixpack: true }
const compra = (id: string, fecha: string, registradoEn: string, estado: Compra['estado'], sobre: Partial<Compra> = {}): Compra => ({
  id, productoId: 'p1', producto: cerveza, presentacion: 'caja', cantidad: 2, costoTotal: 96000, fecha, registradoEn, estado, ...sobre,
})
const nombres = new Map([['p1', 'Cerveza Águila'], ['p2', 'Agua Cristal']])
const compras = [
  compra('c1', '2026-10-20', '2026-10-20T15:00:00.000Z', 'vigente'),
  compra('c2', '2026-10-31', '2026-10-31T15:00:00.000Z', 'anulada', { productoId: 'p2', cantidad: 1, costoTotal: 24000 }),
  compra('c3', '2026-11-02', '2026-11-02T15:00:00.000Z', 'vigente'),
  compra('c4', '2026-11-01', '2026-11-01T15:00:00.000Z', 'vigente', { presentacion: 'unidad', cantidad: 1, costoTotal: 2000 }),
]
const anulaciones = new Map([['c2', { motivo: 'compra duplicada', fecha: '2026-11-01' }]])
const base = { compras, nombres, anulaciones, desde: '2026-10-28', hasta: '2026-11-03', filtro: 'todas' as const }

describe('resumirCompras', () => {
  it('solo toma el periodo y ordena de la más reciente a la más antigua', () => {
    expect(resumirCompras(base).map((t) => t.id)).toEqual(['c3', 'c4', 'c2'])
  })

  it('usa el número guardado en la base, con tres cifras', () => {
    const conNumero = compras.map((c, i) => ({ ...c, numero: 40 + i }))
    expect(resumirCompras({ ...base, compras: conNumero }).map((t) => t.numero)).toEqual(['C-042', 'C-043', 'C-041'])
  })

  it('sin número guardado numera por orden de registro', () => {
    expect(resumirCompras(base).map((t) => t.numero)).toEqual(['C-004', 'C-003', 'C-002'])
  })

  it('arma nombre, cantidad, costo por unidad y total', () => {
    const t = resumirCompras(base)[0]
    expect(t).toMatchObject({
      numero: 'C-004', fecha: '2026-11-02', estado: 'vigente', producto: 'Cerveza Águila',
      cantidadTexto: '2 cajas · 48 unidades', costoPorUnidad: 2000, total: 96000, anulacion: null,
    })
    expect(resumirCompras(base)[1].cantidadTexto).toBe('1 unidad')
  })

  it('las anuladas llevan motivo y las vigentes no', () => {
    const t = resumirCompras(base).find((x) => x.id === 'c2')
    expect(t?.anulacion).toEqual({ motivo: 'compra duplicada', fecha: '2026-11-01' })
    expect(t?.cantidadTexto).toBe('1 caja · 24 unidades')
  })

  it('filtra por estado', () => {
    expect(resumirCompras({ ...base, filtro: 'vigentes' }).map((t) => t.id)).toEqual(['c3', 'c4'])
    expect(resumirCompras({ ...base, filtro: 'anuladas' }).map((t) => t.id)).toEqual(['c2'])
  })

  it('sin límites de fecha toma todo el historial', () => {
    expect(resumirCompras({ ...base, desde: null, hasta: null })).toHaveLength(4)
  })

  it('usa un texto neutro si no conoce el producto', () => {
    expect(resumirCompras({ ...base, nombres: new Map() })[0].producto).toBe('Producto')
  })
})

describe('periodoDeCompras', () => {
  it('últimos 7 días incluye hoy y los 6 anteriores', () => {
    expect(periodoDeCompras('7', '2026-11-03')).toEqual({ desde: '2026-10-28', hasta: '2026-11-03' })
  })

  it('últimos 30 días cruza meses y años', () => {
    expect(periodoDeCompras('30', '2026-01-10')).toEqual({ desde: '2025-12-12', hasta: '2026-01-10' })
  })

  it('todo el historial no pone límites', () => {
    expect(periodoDeCompras('todo', '2026-11-03')).toEqual({ desde: null, hasta: null })
  })
})
