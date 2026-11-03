/**
 * Pruebas del cierre diario.
 *
 * Qué hace: verifica que el cierre del día junte el valor de lo vendido, el
 * efectivo, las transferencias y las deudas del día, y devuelva el cuadre.
 * Cómo lo hace: arma un día de ejemplo con productos, precios, deudas y
 * abonos inventados, y compara el resultado con cuentas hechas a mano.
 * Por qué: el cierre diario es lo que el usuario hace cada noche; tiene que
 * aplicar bien la regla de las deudas (solo las del día y solo por lo que se
 * siga debiendo) para no inflar ni esconder un faltante.
 */
import { describe, it, expect } from 'vitest'
import type { RenglonVenta } from '../ventas/movimientosVenta'
import type { Venta } from '../ventas/venta'
import type { Abono, Deuda } from '../deudas/deudas'
import { cerrarDia, type DatosCierreDiario } from './cierreDiario'

// Producto de ejemplo inventado: unidad a 2.000 y caja x20 a 38.000.
const cervezaA = { unidadesPorCaja: 20, manejaSixpack: true, precioUnidad: 2000, precioCaja: 38000 }

// Venta del día: 1 caja (38.000) + 6 unidades (12.000) = 50.000.
const renglones: RenglonVenta[] = [
  { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1 },
  { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 6 },
]

/** Crea una venta del día de ejemplo; por defecto vigente. */
const venta = (renglonesVenta: RenglonVenta[], estado: Venta['estado'] = 'vigente'): Venta => ({
  id: 'v1',
  fecha: '2026-03-07',
  estado,
  renglones: renglonesVenta,
})

/** Datos del día de ejemplo; por defecto el dinero alcanza justo. */
const datos = (cambios: Partial<DatosCierreDiario> = {}): DatosCierreDiario => ({
  fecha: '2026-03-07',
  ventas: [venta(renglones)],
  efectivo: 30000,
  transferencias: 20000,
  deudas: [],
  abonos: [],
  ...cambios,
})

describe('cerrarDia', () => {
  it('cuadra cuando el dinero es igual a lo vendido', () => {
    expect(cerrarDia(datos())).toEqual({
      dineroTotal: 50000,
      diferencia: 0,
      cuadra: true,
      faltante: 0,
      sobrante: 0,
    })
  })

  it('las deudas del día cuentan como dinero, por lo que sigan debiendo', () => {
    const deudas: Deuda[] = [{ id: 'd1', cliente: 'Cliente X', fecha: '2026-03-07', monto: 10000, descripcion: 'Ronda fiada', estado: 'vigente' }]
    const abonos: Abono[] = [{ id: 'a1', deudaId: 'd1', fecha: '2026-03-07', monto: 4000, descripcion: 'Abono en efectivo', estado: 'vigente' }]
    // 25.000 + 15.000 + (10.000 - 4.000) = 46.000: faltan 4.000.
    const resultado = cerrarDia(datos({ efectivo: 25000, transferencias: 15000, deudas, abonos }))
    expect(resultado.dineroTotal).toBe(46000)
    expect(resultado.faltante).toBe(4000)
    expect(resultado.cuadra).toBe(false)
  })

  it('no cuenta deudas de otros días', () => {
    const deudas: Deuda[] = [
      { id: 'd1', cliente: 'Cliente X', fecha: '2026-03-06', monto: 10000, descripcion: 'Ronda fiada', estado: 'vigente' },
      { id: 'd2', cliente: 'Cliente Y', fecha: '2026-03-08', monto: 10000, descripcion: 'Ronda fiada', estado: 'vigente' },
    ]
    expect(cerrarDia(datos({ deudas })).dineroTotal).toBe(50000)
  })

  it('una deuda del día pagada el mismo día ya no entra', () => {
    const deudas: Deuda[] = [{ id: 'd1', cliente: 'Cliente X', fecha: '2026-03-07', monto: 10000, descripcion: 'Ronda fiada', estado: 'vigente' }]
    const abonos: Abono[] = [{ id: 'a1', deudaId: 'd1', fecha: '2026-03-07', monto: 10000, descripcion: 'Pago completo', estado: 'vigente' }]
    expect(cerrarDia(datos({ deudas, abonos })).dineroTotal).toBe(50000)
  })

  it('suma solo las ventas vigentes, no las anuladas', () => {
    const anulada = { ...venta([{ productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 2 }], 'anulada'), id: 'v2' }
    // La venta anulada (76.000) no suma: lo vendido sigue siendo 50.000.
    expect(cerrarDia(datos({ ventas: [venta(renglones), anulada] })).cuadra).toBe(true)
    expect(cerrarDia(datos({ ventas: [venta(renglones), anulada] })).diferencia).toBe(0)
  })

  it('no cuenta una deuda anulada', () => {
    const deudas: Deuda[] = [{ id: 'd1', cliente: 'Cliente X', fecha: '2026-03-07', monto: 10000, descripcion: 'Ronda fiada', estado: 'anulada' }]
    expect(cerrarDia(datos({ deudas })).dineroTotal).toBe(50000)
  })

  it('respeta el precio cobrado en la venta', () => {
    // Caja cobrada a 35.000 en vez de 38.000: lo vendido es 35.000.
    const conDescuento: RenglonVenta[] = [
      { productoId: 'cerveza-a', producto: cervezaA, presentacion: 'caja', cantidad: 1, precioCobrado: 35000 },
    ]
    const resultado = cerrarDia(datos({ ventas: [venta(conDescuento)], efectivo: 35000, transferencias: 0 }))
    expect(resultado.cuadra).toBe(true)
    expect(resultado.diferencia).toBe(0)
  })

  it('registra el sobrante cuando hay más dinero que venta', () => {
    expect(cerrarDia(datos({ efectivo: 32000 })).sobrante).toBe(2000)
  })

  it('rechaza una fecha inválida o montos inválidos', () => {
    expect(() => cerrarDia(datos({ fecha: '2026-02-30' }))).toThrow()
    expect(() => cerrarDia(datos({ efectivo: -1 }))).toThrow()
    expect(() => cerrarDia(datos({ transferencias: 0.5 }))).toThrow()
  })
})
