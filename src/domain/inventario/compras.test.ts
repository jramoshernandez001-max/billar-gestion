/**
 * Pruebas de las compras.
 *
 * Qué hace: verifica que una compra se convierta en su movimiento de entrada
 * a la bodega y en la referencia de costo (UltimaCompra), y que se elija bien
 * la última compra de un producto.
 * Cómo lo hace: usa productos y costos de ejemplo inventados, con números
 * fáciles de revisar a mano, y compara cada resultado con lo esperado.
 * Por qué: las compras son la única entrada de producto al inventario y la
 * fuente del costo con el que se calcula la utilidad semanal.
 */
import { describe, it, expect } from 'vitest'
import {
  compraAMovimiento,
  compraAUltimaCompra,
  ultimaCompraDe,
  type Compra,
} from './compras'

/** Crea una compra de ejemplo: por defecto 2 cajas x20 por 50.000. */
const compra = (cambios: Partial<Compra> = {}): Compra => ({
  productoId: 'cerveza-a',
  producto: { unidadesPorCaja: 20, manejaSixpack: true },
  presentacion: 'caja',
  cantidad: 2,
  costoTotal: 50000,
  fecha: '2026-01-10',
  registradoEn: '2026-01-10T15:00:00.000Z',
  ...cambios,
})

describe('compraAMovimiento', () => {
  it('una compra entra a la bodega en unidades', () => {
    expect(compraAMovimiento(compra())).toEqual({
      productoId: 'cerveza-a',
      tipo: 'compra',
      ubicacion: 'bodega',
      unidades: 40,
    })
  })

  it('convierte sixpacks y unidades sueltas', () => {
    expect(
      compraAMovimiento(compra({ presentacion: 'sixpack', cantidad: 3 })).unidades,
    ).toBe(18)
    expect(
      compraAMovimiento(compra({ presentacion: 'unidad', cantidad: 7 })).unidades,
    ).toBe(7)
  })

  it('rechaza una compra de cero unidades o con cantidad inválida', () => {
    expect(() => compraAMovimiento(compra({ cantidad: 0 }))).toThrow()
    expect(() => compraAMovimiento(compra({ cantidad: -1 }))).toThrow()
    expect(() => compraAMovimiento(compra({ cantidad: 1.5 }))).toThrow()
  })
})

describe('compraAUltimaCompra', () => {
  it('guarda las unidades que cubrió la compra y lo que se pagó', () => {
    expect(compraAUltimaCompra(compra())).toEqual({
      unidades: 40,
      costoTotal: 50000,
    })
  })

  it('rechaza un costo negativo o con decimales', () => {
    expect(() => compraAUltimaCompra(compra({ costoTotal: -1 }))).toThrow()
    expect(() => compraAUltimaCompra(compra({ costoTotal: 10.5 }))).toThrow()
  })

  it('rechaza una compra de cero unidades', () => {
    expect(() => compraAUltimaCompra(compra({ cantidad: 0 }))).toThrow()
  })
})

describe('ultimaCompraDe', () => {
  it('elige la compra con la fecha más reciente del producto', () => {
    const compras = [
      compra({ fecha: '2026-01-10', costoTotal: 50000 }),
      compra({ fecha: '2026-01-20', costoTotal: 52000 }),
      compra({ fecha: '2026-01-15', costoTotal: 51000 }),
    ]
    expect(ultimaCompraDe(compras, 'cerveza-a')?.costoTotal).toBe(52000)
  })

  it('ignora las compras de otros productos', () => {
    const compras = [
      compra({ fecha: '2026-01-10', costoTotal: 50000 }),
      compra({ productoId: 'cerveza-b', fecha: '2026-02-01', costoTotal: 99000 }),
    ]
    expect(ultimaCompraDe(compras, 'cerveza-a')?.costoTotal).toBe(50000)
  })

  it('devuelve undefined si el producto no tiene compras', () => {
    expect(ultimaCompraDe([compra()], 'cerveza-b')).toBeUndefined()
  })

  it('rechaza fechas inválidas', () => {
    expect(() => ultimaCompraDe([compra({ fecha: '2026-02-30' })], 'cerveza-a')).toThrow()
  })

  it('con varias compras el mismo día, manda la registrada de último', () => {
    const compras = [
      compra({ fecha: '2026-01-20', registradoEn: '2026-01-20T18:30:00.000Z', costoTotal: 52000 }),
      compra({ fecha: '2026-01-20', registradoEn: '2026-01-20T09:00:00.000Z', costoTotal: 50000 }),
      compra({ fecha: '2026-01-15', registradoEn: '2026-01-21T08:00:00.000Z', costoTotal: 49000 }),
    ]
    // La del 15 se registró después, pero manda la fecha de la compra.
    expect(ultimaCompraDe(compras, 'cerveza-a')?.costoTotal).toBe(52000)
  })

  it('lanza un error si dos compras empatan en fecha y en momento de registro', () => {
    const compras = [
      compra({ fecha: '2026-01-20', registradoEn: '2026-01-20T09:00:00.000Z', costoTotal: 50000 }),
      compra({ fecha: '2026-01-20', registradoEn: '2026-01-20T09:00:00.000Z', costoTotal: 52000 }),
    ]
    expect(() => ultimaCompraDe(compras, 'cerveza-a')).toThrow(/mismo momento/i)
  })

  it('rechaza un momento de registro que no esté en formato ISO UTC', () => {
    expect(() =>
      ultimaCompraDe([compra({ registradoEn: '2026-01-10 15:00' })], 'cerveza-a'),
    ).toThrow(/registro/i)
  })
})
