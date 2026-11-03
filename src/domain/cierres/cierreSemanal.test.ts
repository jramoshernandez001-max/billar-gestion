/**
 * Pruebas del cierre semanal.
 *
 * Qué hace: verifica que el cierre semanal arme el costo de reponer lo
 * vendido con la última compra de cada producto, cuadre la semana con sus
 * deudas y devuelva la utilidad esperada, la real y la diferencia.
 * Cómo lo hace: arma una semana de ejemplo con productos, precios, costos,
 * deudas y abonos inventados, con números fáciles de revisar a mano.
 * Por qué: es el resumen que el dueño usa para saber cuánto ganó; tiene que
 * combinar bien ventas, compras y deudas.
 */
import { describe, it, expect } from 'vitest'
import type { Compra } from '../inventario/compras'
import type { RenglonVenta } from '../ventas/movimientosVenta'
import type { Venta } from '../ventas/venta'
import type { Deuda } from '../deudas/deudas'
import {
  cerrarSemana,
  lineasReposicion,
  type CierreSemanalCompleto,
  type DatosCierreSemanal,
  type ResultadoCierreSemanal,
} from './cierreSemanal'

// Productos de ejemplo inventados.
const cervezaA = { unidadesPorCaja: 20, manejaSixpack: true, precioUnidad: 2000, precioCaja: 40000 }
const cervezaB = { unidadesPorCaja: 10, manejaSixpack: false, precioUnidad: 3000, precioCaja: 30000 }

/** Crea una compra de ejemplo de una caja. */
const compra = (productoId: string, fecha: string, costoTotal: number): Compra => ({
  id: `${productoId}-${fecha}`,
  productoId,
  producto: productoId === 'cerveza-a' ? cervezaA : cervezaB,
  presentacion: 'caja',
  cantidad: 1,
  costoTotal,
  fecha,
  registradoEn: `${fecha}T12:00:00.000Z`,
})

// Compras: para A manda la del 2026-03-05 (caja x20 por 30.000 = 1.500 c/u);
// para B la única (caja x10 por 20.000 = 2.000 c/u).
const compras: Compra[] = [
  compra('cerveza-a', '2026-02-20', 28000),
  compra('cerveza-a', '2026-03-05', 30000),
  compra('cerveza-b', '2026-03-01', 20000),
]

// Venta de la semana: A 1 caja (40.000) + 4 unidades (8.000); B 5 unidades
// (15.000). Total 63.000. Unidades: A 24, B 5.
const renglones: RenglonVenta[] = [
  { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1 },
  { productoId: 'cerveza-b', producto: cervezaB, presentacion: 'unidad', cantidad: 5 },
  { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 4 },
]

/** Devuelve el resultado como cierre completo, o hace fallar la prueba. */
const comoCompleto = (resultado: ResultadoCierreSemanal): CierreSemanalCompleto => {
  if (!resultado.completo) throw new Error('Se esperaba un cierre completo')
  return resultado
}

/** Envuelve renglones en una venta de ejemplo; por defecto vigente. */
const vigente = (renglonesVenta: RenglonVenta[], estado: Venta['estado'] = 'vigente'): Venta => ({
  id: `venta-${estado}`,
  fecha: '2026-03-12',
  estado,
  renglones: renglonesVenta,
})

/** Semana de ejemplo; por defecto el dinero alcanza justo. */
const datos = (cambios: Partial<DatosCierreSemanal> = {}): DatosCierreSemanal => ({
  desde: '2026-03-09',
  hasta: '2026-03-15',
  ventas: [vigente(renglones)],
  efectivo: 43000,
  transferencias: 20000,
  deudas: [],
  abonos: [],
  compras,
  ...cambios,
})

describe('lineasReposicion', () => {
  it('suma las unidades vendidas por producto y toma su última compra', () => {
    expect(lineasReposicion(renglones, compras, '2026-03-15')).toEqual({
      lineas: [
        { unidadesVendidas: 24, ultimaCompra: { unidades: 20, costoTotal: 30000 } },
        { unidadesVendidas: 5, ultimaCompra: { unidades: 10, costoTotal: 20000 } },
      ],
      productosSinCosto: [],
      comprasUsadas: ['cerveza-a-2026-03-05', 'cerveza-b-2026-03-01'],
    })
  })

  it('no pide costo para un producto con cero unidades vendidas', () => {
    const sinVenta: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 0 },
    ]
    expect(lineasReposicion(sinVenta, compras, '2026-03-15')).toEqual({
      lineas: [],
      productosSinCosto: [],
      comprasUsadas: [],
    })
  })

  it('un producto vendido sin compras y sin costo manual queda en la lista sin costo', () => {
    const sinCompras: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 1 },
    ]
    expect(lineasReposicion(sinCompras, compras, '2026-03-15')).toEqual({
      lineas: [],
      productosSinCosto: ['cerveza-c'],
      comprasUsadas: [],
    })
  })

  it('un producto sin compras usa el costo manual por unidad si se da', () => {
    const sinCompras: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 3 },
    ]
    expect(lineasReposicion(sinCompras, compras, '2026-03-15', { 'cerveza-c': 1800 })).toEqual({
      lineas: [{ unidadesVendidas: 3, ultimaCompra: { unidades: 1, costoTotal: 1800 } }],
      productosSinCosto: [],
      // Un costo manual no es una compra: no queda en la lista de usadas.
      comprasUsadas: [],
    })
  })

  it('un producto con compras solo posteriores a la semana cuenta como sin compras', () => {
    const vendido: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 1 },
    ]
    const posterior = [compra('cerveza-c', '2026-03-16', 20000)]
    expect(lineasReposicion(vendido, posterior, '2026-03-15').productosSinCosto).toEqual(['cerveza-c'])
  })

  it('rechaza un costo manual negativo o con decimales', () => {
    const sinCompras: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 1 },
    ]
    expect(() => lineasReposicion(sinCompras, compras, '2026-03-15', { 'cerveza-c': -1 })).toThrow()
    expect(() => lineasReposicion(sinCompras, compras, '2026-03-15', { 'cerveza-c': 1.5 })).toThrow()
  })
})

describe('cerrarSemana', () => {
  it('usa la última compra hasta el último día de la semana, no las posteriores', () => {
    // Compra de A después del cierre, con otro costo: no debe cambiar nada,
    // así recalcular el cierre más tarde da el mismo resultado.
    const conCompraPosterior = [...compras, compra('cerveza-a', '2026-03-16', 99000)]
    expect(cerrarSemana(datos({ compras: conCompraPosterior })).costoReposicion).toBe(46000)
  })

  it('devuelve el costo de reposición, el cuadre y la utilidad', () => {
    // Costo: A 24 x 1.500 = 36.000; B 5 x 2.000 = 10.000. Total 46.000.
    expect(cerrarSemana(datos())).toEqual({
      costoReposicion: 46000,
      completo: true,
      productosSinCosto: [],
      ventasSinCosto: 0,
      comprasUsadas: ['cerveza-a-2026-03-05', 'cerveza-b-2026-03-01'],
      cuadre: { dineroTotal: 63000, diferencia: 0, cuadra: true, faltante: 0, sobrante: 0 },
      utilidad: { utilidadEsperada: 17000, utilidadReal: 17000, diferencia: 0 },
    })
  })

  it('con faltante, la utilidad real baja en lo que falta', () => {
    const resultado = comoCompleto(cerrarSemana(datos({ efectivo: 40000 })))
    expect(resultado.cuadre.faltante).toBe(3000)
    expect(resultado.utilidad).toEqual({
      utilidadEsperada: 17000,
      utilidadReal: 14000,
      diferencia: -3000,
    })
  })

  it('las deudas de la semana cuentan como dinero; las de antes no', () => {
    const deudas: Deuda[] = [
      { id: 'd1', cliente: 'Cliente X', fecha: '2026-03-12', monto: 3000, descripcion: 'Ronda fiada' },
      { id: 'd2', cliente: 'Cliente Y', fecha: '2026-03-02', monto: 9000, descripcion: 'Ronda fiada' },
    ]
    const resultado = comoCompleto(cerrarSemana(datos({ efectivo: 40000, deudas })))
    expect(resultado.cuadre.dineroTotal).toBe(63000)
    expect(resultado.cuadre.cuadra).toBe(true)
    expect(resultado.utilidad.utilidadReal).toBe(17000)
  })

  it('sin costo para un producto no falla: calcula con los demás y marca incompleto', () => {
    // C: 2 unidades a 3.000 = 6.000 más de venta, sin compras ni costo manual.
    const conC: RenglonVenta[] = [
      ...renglones,
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 2 },
    ]
    const resultado = cerrarSemana(datos({ ventas: [vigente(conC)], efectivo: 49000 }))
    expect(resultado.completo).toBe(false)
    expect(resultado.productosSinCosto).toEqual(['cerveza-c'])
    // El costo es solo el de A y B; nunca se toma el de C como cero en silencio.
    expect(resultado.costoReposicion).toBe(46000)
  })

  it('incompleto: no calcula utilidad real; devuelve esperada, ventas sin costo y cuadre por separado', () => {
    const conC: RenglonVenta[] = [
      ...renglones,
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 2 },
    ]
    const resultado = cerrarSemana(datos({ ventas: [vigente(conC)], efectivo: 49000 }))
    expect(resultado).toEqual({
      completo: false,
      costoReposicion: 46000,
      productosSinCosto: ['cerveza-c'],
      ventasSinCosto: 6000,
      comprasUsadas: ['cerveza-a-2026-03-05', 'cerveza-b-2026-03-01'],
      // Venta total 69.000 contra dinero 69.000.
      cuadre: { dineroTotal: 69000, diferencia: 0, cuadra: true, faltante: 0, sobrante: 0 },
      // Solo productos con costo: ventas con costo (63.000) - costo (46.000).
      utilidadEsperada: 17000,
    })
    expect('utilidad' in resultado).toBe(false)
  })

  it('el cuadre de un cierre incompleto sigue usando la venta total', () => {
    const conC: RenglonVenta[] = [
      ...renglones,
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 2 },
    ]
    // Dinero 66.000 contra venta total 69.000: faltan 3.000.
    const resultado = cerrarSemana(datos({ ventas: [vigente(conC)], efectivo: 46000 }))
    expect(resultado.cuadre).toEqual({
      dineroTotal: 66000,
      diferencia: -3000,
      cuadra: false,
      faltante: 3000,
      sobrante: 0,
    })
  })

  it('en un cierre incompleto, el faltante no se mezcla con la utilidad esperada', () => {
    const conC: RenglonVenta[] = [
      ...renglones,
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 2 },
    ]
    const resultado = cerrarSemana(datos({ ventas: [vigente(conC)], efectivo: 0, transferencias: 3000 }))
    if (resultado.completo) throw new Error('Se esperaba un cierre incompleto')
    expect(resultado.cuadre.faltante).toBe(66000)
    expect(resultado.utilidadEsperada).toBe(17000)
  })

  it('con costo manual para el producto sin compras, el cierre queda completo', () => {
    const conC: RenglonVenta[] = [
      ...renglones,
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 2 },
    ]
    const resultado = cerrarSemana(
      datos({ ventas: [vigente(conC)], efectivo: 49000, costosManuales: { 'cerveza-c': 1800 } }),
    )
    expect(resultado.completo).toBe(true)
    expect(resultado.costoReposicion).toBe(46000 + 3600)
  })

  it('un inventario inicial cargado como compras con fecha anterior da costo al siguiente cierre', () => {
    // El inventario inicial no usa ajustes: se registra como compras con la
    // fecha que elige el usuario (antes de la semana), aunque el registro en
    // el sistema se haga después, ya dentro de la semana.
    const inventarioInicial: Compra[] = [
      { ...compra('cerveza-a', '2026-03-01', 30000), id: 'inicial-a', registradoEn: '2026-03-10T14:00:00.000Z' },
      { ...compra('cerveza-b', '2026-03-01', 20000), id: 'inicial-b', registradoEn: '2026-03-10T14:05:00.000Z' },
    ]
    const resultado = cerrarSemana(datos({ compras: inventarioInicial }))
    expect(resultado.completo).toBe(true)
    expect(resultado.productosSinCosto).toEqual([])
    // A: 24 x 1.500 = 36.000; B: 5 x 2.000 = 10.000.
    expect(resultado.costoReposicion).toBe(46000)
    expect(resultado.comprasUsadas).toEqual(['inicial-a', 'inicial-b'])
  })

  it('suma solo las ventas vigentes, no las anuladas', () => {
    const anulada = vigente([{ productoId: 'cerveza-b', producto: cervezaB, presentacion: 'caja', cantidad: 3 }], 'anulada')
    const resultado = cerrarSemana(datos({ ventas: [vigente(renglones), anulada] }))
    // La venta anulada no suma a lo vendido ni al costo de reposición.
    expect(resultado.cuadre.diferencia).toBe(0)
    expect(resultado.costoReposicion).toBe(46000)
  })

  it('rechaza una semana que no va de lunes a domingo', () => {
    expect(() => cerrarSemana(datos({ desde: '2026-03-10', hasta: '2026-03-16' }))).toThrow(/lunes/i)
    expect(() => cerrarSemana(datos({ hasta: '2026-03-14' }))).toThrow(/domingo/i)
  })

  it('rechaza un periodo con inicio posterior al fin', () => {
    expect(() => cerrarSemana(datos({ desde: '2026-03-16' }))).toThrow()
  })
})
