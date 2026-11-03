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
import type { Deuda } from '../deudas/deudas'
import { cerrarSemana, lineasReposicion, type DatosCierreSemanal } from './cierreSemanal'

// Productos de ejemplo inventados.
const cervezaA = { unidadesPorCaja: 20, manejaSixpack: true, precioUnidad: 2000, precioCaja: 40000 }
const cervezaB = { unidadesPorCaja: 10, manejaSixpack: false, precioUnidad: 3000, precioCaja: 30000 }

/** Crea una compra de ejemplo de una caja. */
const compra = (productoId: string, fecha: string, costoTotal: number): Compra => ({
  productoId,
  producto: productoId === 'cerveza-a' ? cervezaA : cervezaB,
  presentacion: 'caja',
  cantidad: 1,
  costoTotal,
  fecha,
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

/** Semana de ejemplo; por defecto el dinero alcanza justo. */
const datos = (cambios: Partial<DatosCierreSemanal> = {}): DatosCierreSemanal => ({
  desde: '2026-03-09',
  hasta: '2026-03-15',
  renglones,
  efectivo: 43000,
  transferencias: 20000,
  deudas: [],
  abonos: [],
  compras,
  ...cambios,
})

describe('lineasReposicion', () => {
  it('suma las unidades vendidas por producto y toma su última compra', () => {
    expect(lineasReposicion(renglones, compras)).toEqual([
      { unidadesVendidas: 24, ultimaCompra: { unidades: 20, costoTotal: 30000 } },
      { unidadesVendidas: 5, ultimaCompra: { unidades: 10, costoTotal: 20000 } },
    ])
  })

  it('no pide costo para un producto con cero unidades vendidas', () => {
    const sinVenta: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 0 },
    ]
    expect(lineasReposicion(sinVenta, compras)).toEqual([])
  })

  it('rechaza un producto vendido sin compras registradas', () => {
    const sinCompras: RenglonVenta[] = [
      { productoId: 'cerveza-c', producto: cervezaB, presentacion: 'unidad', cantidad: 1 },
    ]
    expect(() => lineasReposicion(sinCompras, compras)).toThrow(/compra/i)
  })
})

describe('cerrarSemana', () => {
  it('devuelve el costo de reposición, el cuadre y la utilidad', () => {
    // Costo: A 24 x 1.500 = 36.000; B 5 x 2.000 = 10.000. Total 46.000.
    expect(cerrarSemana(datos())).toEqual({
      costoReposicion: 46000,
      cuadre: { dineroTotal: 63000, diferencia: 0, cuadra: true, faltante: 0, sobrante: 0 },
      utilidad: { utilidadEsperada: 17000, utilidadReal: 17000, diferencia: 0 },
    })
  })

  it('con faltante, la utilidad real baja en lo que falta', () => {
    const resultado = cerrarSemana(datos({ efectivo: 40000 }))
    expect(resultado.cuadre.faltante).toBe(3000)
    expect(resultado.utilidad).toEqual({
      utilidadEsperada: 17000,
      utilidadReal: 14000,
      diferencia: -3000,
    })
  })

  it('las deudas de la semana cuentan como dinero; las de antes no', () => {
    const deudas: Deuda[] = [
      { id: 'd1', cliente: 'Cliente X', fecha: '2026-03-12', monto: 3000 },
      { id: 'd2', cliente: 'Cliente Y', fecha: '2026-03-02', monto: 9000 },
    ]
    const resultado = cerrarSemana(datos({ efectivo: 40000, deudas }))
    expect(resultado.cuadre.dineroTotal).toBe(63000)
    expect(resultado.cuadre.cuadra).toBe(true)
    expect(resultado.utilidad.utilidadReal).toBe(17000)
  })

  it('rechaza un periodo con inicio posterior al fin', () => {
    expect(() => cerrarSemana(datos({ desde: '2026-03-16' }))).toThrow()
  })
})
