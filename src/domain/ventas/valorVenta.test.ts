/**
 * Pruebas del cálculo del valor de una venta.
 *
 * Qué hace: verifica el precio de lista de cada presentación (unidad, sixpack,
 * caja), el valor de cada renglón de la venta y el total de la venta.
 * Cómo lo hace: usa tres cervezas de ejemplo con sus precios reales y compara
 * el resultado de cada función con el valor esperado, a mano.
 * Por qué: el valor de la venta es lo que se compara con el dinero en el
 * cierre del día; un error aquí produce faltantes falsos.
 */
import { describe, it, expect } from 'vitest'
import {
  precioDeLista,
  valorItem,
  valorVenta,
  type ProductoVendible,
} from './valorVenta'

// Cerveza en botella, caja x38, sin sixpack.
const costenita: ProductoVendible = {
  unidadesPorCaja: 38,
  manejaSixpack: false,
  precioUnidad: 3000,
  precioCaja: 114000,
}
// Cerveza con sixpack, caja x24.
const coronita: ProductoVendible = {
  unidadesPorCaja: 24,
  manejaSixpack: true,
  precioUnidad: 4000,
  precioCaja: 96000,
}
// Cerveza en botella, caja x30, sin sixpack.
const aguila: ProductoVendible = {
  unidadesPorCaja: 30,
  manejaSixpack: false,
  precioUnidad: 3500,
  precioCaja: 105000,
}

describe('precioDeLista', () => {
  it('la unidad usa el precio de la unidad', () => {
    expect(precioDeLista(coronita, 'unidad')).toBe(4000)
  })

  it('el sixpack vale seis veces el precio de la unidad', () => {
    expect(precioDeLista(coronita, 'sixpack')).toBe(24000)
  })

  it('la caja usa su propio precio, que puede ser distinto de unidades x precio', () => {
    expect(precioDeLista(coronita, 'caja')).toBe(96000)
  })

  it('rechaza sixpack en un producto que no lo maneja', () => {
    expect(() => precioDeLista(costenita, 'sixpack')).toThrow(/sixpack/i)
  })
})

describe('valorItem', () => {
  it('multiplica la cantidad por el precio de lista', () => {
    const item = { producto: costenita, presentacion: 'unidad', cantidad: 3 } as const
    expect(valorItem(item)).toBe(9000)
  })

  it('usa el precio cobrado cuando se cambia en la venta', () => {
    // Caja de Costeñita a domicilio: 100.000 en vez de 114.000.
    const item = {
      producto: costenita,
      presentacion: 'caja',
      cantidad: 1,
      precioCobrado: 100000,
    } as const
    expect(valorItem(item)).toBe(100000)
  })

  it('el precio cobrado aplica a cada presentación vendida', () => {
    const item = {
      producto: costenita,
      presentacion: 'caja',
      cantidad: 2,
      precioCobrado: 100000,
    } as const
    expect(valorItem(item)).toBe(200000)
  })

  it('rechaza cantidades negativas o con decimales', () => {
    const base = { producto: costenita, presentacion: 'unidad' } as const
    expect(() => valorItem({ ...base, cantidad: -1 })).toThrow()
    expect(() => valorItem({ ...base, cantidad: 1.5 })).toThrow()
  })

  it('rechaza precios cobrados negativos o con decimales', () => {
    const base = { producto: costenita, presentacion: 'unidad', cantidad: 1 } as const
    expect(() => valorItem({ ...base, precioCobrado: -1 })).toThrow()
    expect(() => valorItem({ ...base, precioCobrado: 2500.5 })).toThrow()
  })
})

describe('valorVenta', () => {
  it('una venta sin renglones vale cero', () => {
    expect(valorVenta([])).toBe(0)
  })

  it('suma el valor de todos los renglones', () => {
    // 2 cajas de Costeñita (228.000) + 1 sixpack de Coronita (24.000)
    // + 3 unidades de Águila (10.500) = 262.500.
    const items = [
      { producto: costenita, presentacion: 'caja', cantidad: 2 },
      { producto: coronita, presentacion: 'sixpack', cantidad: 1 },
      { producto: aguila, presentacion: 'unidad', cantidad: 3 },
    ] as const
    expect(valorVenta(items)).toBe(262500)
  })
})