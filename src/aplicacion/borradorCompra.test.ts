/**
 * Pruebas del borrador de compra (varios productos en una sola compra).
 *
 * Qué hace: verifica agregar, cambiar y quitar renglones, el total general y
 * el paso a los datos que se guardan.
 * Cómo lo hace: arma borradores con un catálogo de ejemplo (datos inventados).
 * Por qué: el negocio compra varios productos a la vez y quiere registrarlos
 * con un solo botón, escribiendo el precio de cada caja.
 */
import { describe, it, expect } from 'vitest'
import {
  aDatosCompras,
  agregarRenglonCompra,
  borradorCompraVacio,
  calcularBorradorCompra,
  cambiarRenglonCompra,
  quitarRenglonCompra,
  type CatalogoCompra,
} from './borradorCompra'

const catalogo: CatalogoCompra = new Map([
  ['cerveza', { unidadesPorCaja: 30, manejaSixpack: false, categoria: 'cerveza' as const }],
  ['lata', { unidadesPorCaja: 24, manejaSixpack: true, categoria: 'cerveza' as const }],
  ['ron', { unidadesPorCaja: 1, manejaSixpack: false, categoria: 'licor' as const }],
])

describe('borradorCompraVacio', () => {
  it('empieza con un renglón: el producto que viene de la ruta, por caja y cantidad 1', () => {
    expect(borradorCompraVacio('2026-11-18', 'cerveza', catalogo)).toEqual({
      fecha: '2026-11-18',
      renglones: [{ clave: 'r1', productoId: 'cerveza', presentacion: 'caja', cantidad: 1, precio: null }],
    })
  })

  it('un licor empieza por botella; sin producto queda por elegir', () => {
    expect(borradorCompraVacio('2026-11-18', 'ron', catalogo).renglones[0].presentacion).toBe('unidad')
    expect(borradorCompraVacio('2026-11-18', undefined, catalogo).renglones[0].productoId).toBeNull()
  })
})

describe('renglones', () => {
  it('agrega, cambia y quita renglones', () => {
    let b = borradorCompraVacio('2026-11-18', 'cerveza', catalogo)
    b = agregarRenglonCompra(b, 'r2')
    b = cambiarRenglonCompra(b, 'r2', { productoId: 'lata', presentacion: 'sixpack', cantidad: 3, precio: 15000 }, catalogo)
    expect(b.renglones[1]).toEqual({ clave: 'r2', productoId: 'lata', presentacion: 'sixpack', cantidad: 3, precio: 15000 })
    b = quitarRenglonCompra(b, 'r1')
    expect(b.renglones.map((r) => r.clave)).toEqual(['r2'])
  })

  it('al elegir un licor pasa a botella, y una presentación no permitida vuelve a caja', () => {
    let b = cambiarRenglonCompra(borradorCompraVacio('2026-11-18', 'cerveza', catalogo), 'r1', { productoId: 'ron' }, catalogo)
    expect(b.renglones[0].presentacion).toBe('unidad')
    b = cambiarRenglonCompra(b, 'r1', { productoId: 'cerveza', presentacion: 'sixpack' }, catalogo)
    expect(b.renglones[0].presentacion).toBe('caja')
  })
})

describe('calcularBorradorCompra', () => {
  it('suma el total de todos los renglones', () => {
    let b = borradorCompraVacio('2026-11-18', 'cerveza', catalogo)
    b = cambiarRenglonCompra(b, 'r1', { cantidad: 10, precio: 74000 }, catalogo)
    b = cambiarRenglonCompra(agregarRenglonCompra(b, 'r2'), 'r2', { productoId: 'ron', cantidad: 2, precio: 45000 }, catalogo)
    const c = calcularBorradorCompra(b, catalogo)
    expect(c.renglones.map((r) => r.costoTotal)).toEqual([740000, 90000])
    expect(c.total).toBe(830000)
    expect(c.unidades).toBe(302)
    expect(c.puedeRegistrar).toBe(true)
    expect(c.problema).toBeNull()
  })

  it('no se registra si falta un precio, un producto o no hay renglones', () => {
    const sinPrecio = calcularBorradorCompra(borradorCompraVacio('2026-11-18', 'cerveza', catalogo), catalogo)
    expect(sinPrecio.puedeRegistrar).toBe(false)
    expect(sinPrecio.problema).toMatch(/renglón 1.*precio de la caja/i)
    const sinProducto = calcularBorradorCompra(borradorCompraVacio('2026-11-18', undefined, catalogo), catalogo)
    expect(sinProducto.problema).toMatch(/renglón 1.*producto/i)
    const vacio = calcularBorradorCompra({ fecha: '2026-11-18', renglones: [] }, catalogo)
    expect(vacio).toMatchObject({ puedeRegistrar: false, total: 0 })
    expect(vacio.problema).toMatch(/agrega/i)
  })
})

describe('aDatosCompras', () => {
  it('pasa el borrador a los datos que se guardan, con el total de cada renglón', () => {
    const b = cambiarRenglonCompra(borradorCompraVacio('2026-11-18', 'cerveza', catalogo), 'r1', { cantidad: 10, precio: 74000 }, catalogo)
    expect(aDatosCompras(b, catalogo)).toEqual({
      fecha: '2026-11-18',
      renglones: [{ productoId: 'cerveza', presentacion: 'caja', cantidad: 10, costoTotal: 740000 }],
    })
  })

  it('lanza el problema si el borrador no se puede registrar', () => {
    expect(() => aDatosCompras(borradorCompraVacio('2026-11-18', 'cerveza', catalogo), catalogo)).toThrow(/precio/i)
  })
})
