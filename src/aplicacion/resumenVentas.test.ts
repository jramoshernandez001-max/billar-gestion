/**
 * Pruebas del listado de ventas.
 *
 * Qué hace: verifica el filtro (todas, vigentes, anuladas), el resumen de
 * vigentes (cantidad, unidades y total), la numeración V-n, la hora, el texto
 * de cada renglón, el motivo de las anuladas y el límite de tarjetas.
 * Cómo lo hace: ventas y productos inventados con números hechos a mano.
 * Por qué: la pantalla solo dibuja este resumen; un total o una unidad mal
 * contados llevarían a revisar el dinero con datos equivocados.
 */
import { describe, it, expect } from 'vitest'
import { anulacionesDeVentas, resumirVentas, type AnulacionVenta, type NombresProductos } from './resumenVentas'
import type { EntradaBitacora } from '../datos/bitacora'
import type { VentaRegistrada } from '../datos/ventas'

const aguila = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const nombres: NombresProductos = new Map([['p1', 'Águila'], ['p2', 'Coca-Cola']])
const instante = (dia: number, h: number, m: number) => new Date(2026, 10, dia, h, m).toISOString()

const venta = (id: string, creadoEn: string, estado: VentaRegistrada['estado'], renglones: VentaRegistrada['renglones'], fecha = '2026-11-03'): VentaRegistrada => ({
  id, fecha, estado, creadoEn, renglones,
})
const renglon = (productoId: string, presentacion: 'unidad' | 'sixpack' | 'caja', cantidad: number, precioCobrado: number) => ({
  productoId, producto: aguila, presentacion, cantidad, precioCobrado,
})

const ventas = [
  venta('v3', instante(3, 15, 5), 'vigente', [renglon('p1', 'unidad', 10, 3000)]),
  venta('v1', instante(2, 10, 0), 'vigente', [renglon('p2', 'unidad', 1, 3000)], '2026-11-02'),
  venta('v2', instante(3, 13, 10), 'anulada', [renglon('p1', 'unidad', 2, 3000)]),
  venta('v4', instante(3, 16, 20), 'vigente', [renglon('p1', 'caja', 1, 55000), renglon('p2', 'sixpack', 2, 18000)]),
]
const anulaciones = new Map<string, AnulacionVenta>([['v2', { motivo: 'registro duplicado', fecha: '2026-11-03' }]])

describe('resumirVentas', () => {
  it('solo toma las ventas del día y las ordena de la más reciente a la más antigua', () => {
    const { tarjetas } = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 10 })
    expect(tarjetas.map((t) => t.id)).toEqual(['v4', 'v3', 'v2'])
  })

  it('numera por orden de registro de todas las ventas, no solo las del día', () => {
    const { tarjetas } = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 10 })
    expect(tarjetas.map((t) => t.numero)).toEqual(['V-4', 'V-3', 'V-2'])
  })

  it('muestra hora, renglones con presentación y precio, y el total de la venta', () => {
    const { tarjetas } = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 10 })
    const v4 = tarjetas[0]
    expect(v4.hora).toBe('16:20')
    expect(v4.renglones).toEqual([
      { descripcion: 'Águila · Caja × 1', detalle: '$ 55.000 c/u · $ 55.000' },
      { descripcion: 'Coca-Cola · Sixpack × 2', detalle: '$ 18.000 c/u · $ 36.000' },
    ])
    expect(v4.total).toBe(91000)
  })

  it('resume solo las vigentes: cantidad, unidades y total', () => {
    const r = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 10 })
    // v3: 10 unidades ($30.000); v4: 24 + 12 = 36 unidades ($91.000).
    expect(r.vigentes).toBe(2)
    expect(r.unidades).toBe(46)
    expect(r.total).toBe(121000)
  })

  it('filtra por estado y el resumen no cambia', () => {
    const base = { ventas, nombres, anulaciones, fecha: '2026-11-03', limite: 10 }
    expect(resumirVentas({ ...base, filtro: 'vigentes' }).tarjetas.map((t) => t.id)).toEqual(['v4', 'v3'])
    const anuladas = resumirVentas({ ...base, filtro: 'anuladas' })
    expect(anuladas.tarjetas.map((t) => t.id)).toEqual(['v2'])
    expect(anuladas.total).toBe(121000)
  })

  it('las anuladas llevan motivo y fecha de anulación; las vigentes no', () => {
    const { tarjetas } = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 10 })
    expect(tarjetas.find((t) => t.id === 'v2')?.anulacion).toEqual({ motivo: 'registro duplicado', fecha: '2026-11-03' })
    expect(tarjetas.find((t) => t.id === 'v3')?.anulacion).toBeNull()
  })

  it('una anulada sin registro en la bitácora no inventa motivo', () => {
    const { tarjetas } = resumirVentas({ ventas, nombres, anulaciones: new Map(), fecha: '2026-11-03', filtro: 'anuladas', limite: 10 })
    expect(tarjetas[0].anulacion).toBeNull()
  })

  it('aplica el límite y dice cuántas hay en total para "cargar más"', () => {
    const r = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-11-03', filtro: 'todas', limite: 2 })
    expect(r.tarjetas.map((t) => t.id)).toEqual(['v4', 'v3'])
    expect(r.totalMovimientos).toBe(3)
  })

  it('usa un texto neutro si no conoce el nombre del producto', () => {
    const r = resumirVentas({ ventas, nombres: new Map(), anulaciones, fecha: '2026-11-03', filtro: 'vigentes', limite: 1 })
    expect(r.tarjetas[0].renglones[0].descripcion).toBe('Producto · Caja × 1')
  })

  it('sin ventas en el día devuelve todo en cero', () => {
    const r = resumirVentas({ ventas, nombres, anulaciones, fecha: '2026-12-01', filtro: 'todas', limite: 10 })
    expect(r).toEqual({ vigentes: 0, unidades: 0, total: 0, tarjetas: [], totalMovimientos: 0 })
  })
})

describe('anulacionesDeVentas', () => {
  const entrada = (sobre: Partial<EntradaBitacora>): EntradaBitacora => ({
    id: 'b', momento: new Date(2026, 10, 3, 17, 0).toISOString(), usuario: 'ana@ejemplo.com',
    accion: 'anular-registro', tabla: 'ventas', registroId: 'v2', antes: null, despues: {}, motivo: 'registro duplicado', ...sobre,
  })

  it('toma motivo y día local de las anulaciones de ventas', () => {
    expect(anulacionesDeVentas([entrada({})]).get('v2')).toEqual({ motivo: 'registro duplicado', fecha: '2026-11-03' })
  })

  it('ignora otras acciones, otras tablas y entradas sin registro o motivo', () => {
    const lista = [
      entrada({ accion: 'registrar-venta' }),
      entrada({ tabla: 'compras' }),
      entrada({ registroId: null }),
      entrada({ motivo: null }),
    ]
    expect(anulacionesDeVentas(lista).size).toBe(0)
  })
})
