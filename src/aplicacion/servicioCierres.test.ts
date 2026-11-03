/**
 * Pruebas del servicio de cierres.
 *
 * Qué hace: verifica que calcular un cierre cargue los datos, los filtre por
 * periodo, use el cálculo del dominio y guarde el resultado; y que recalcular
 * use el dinero y los costos manuales ya guardados.
 * Cómo lo hace: repositorios falsos en memoria, con ventas, deudas y compras
 * inventadas, y números calculados a mano.
 * Por qué: este servicio es el pegamento entre la base y el dominio; si filtra
 * mal el periodo, el cierre cuadra con ventas de otros días.
 */
import { describe, it, expect, vi } from 'vitest'
import { crearServicioCierres } from './servicioCierres'
import type { Venta } from '../domain/ventas/venta'
import type { Compra } from '../domain/inventario/compras'
import type { CierreLeido } from '../datos/cierres'

const P1 = 'p1'
const producto = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const venta = (id: string, fecha: string, cantidad: number, estado: 'vigente' | 'anulada' = 'vigente'): Venta => ({
  id,
  fecha,
  estado,
  renglones: [{ productoId: P1, producto, presentacion: 'unidad', cantidad, precioCobrado: 3000 }],
})
const compra: Compra = {
  id: 'c1',
  productoId: P1,
  producto: { unidadesPorCaja: 24, manejaSixpack: true },
  presentacion: 'caja',
  cantidad: 1,
  costoTotal: 48000, // 2000 por unidad
  fecha: '2026-11-01',
  registradoEn: '2026-11-01T15:00:00.000Z',
  estado: 'vigente',
}

function armar(opciones: { ventas?: Venta[]; cierres?: CierreLeido[] } = {}) {
  const guardarCierre = vi.fn(async () => 'nuevo-id')
  const recalcularCierre = vi.fn(async () => undefined)
  const servicio = crearServicioCierres({
    ventas: { listarVentas: async () => opciones.ventas ?? [] },
    deudas: {
      listarDeudas: async () => [{ id: 'd1', cliente: 'Ana', fecha: '2026-11-03', monto: 1000, descripcion: 'Fiado', estado: 'vigente' as const }],
      listarAbonos: async () => [],
    },
    inventario: { listarCompras: async () => [compra] },
    cierres: {
      guardarCierre,
      recalcularCierre,
      listarCierres: async () => opciones.cierres ?? [],
    },
  })
  return { servicio, guardarCierre, recalcularCierre }
}

describe('cerrarPeriodo diario', () => {
  it('cuadra con las ventas vigentes del día y las deudas nacidas ese día', async () => {
    const { servicio, guardarCierre } = armar({
      ventas: [venta('a', '2026-11-03', 2), venta('b', '2026-11-03', 5, 'anulada'), venta('c', '2026-11-02', 9)],
    })
    const id = await servicio.cerrarPeriodo({ tipo: 'diario', desde: '2026-11-03', efectivo: 4000, transferencias: 1000 })
    expect(id).toBe('nuevo-id')
    // vendido 6000; dinero 4000 + 1000 + deuda 1000 = 6000
    expect(guardarCierre).toHaveBeenCalledWith({
      tipo: 'diario',
      desde: '2026-11-03',
      hasta: '2026-11-03',
      efectivo: 4000,
      transferencias: 1000,
      costosManuales: {},
      costosUsados: [],
      resultado: { dineroTotal: 6000, diferencia: 0, cuadra: true, faltante: 0, sobrante: 0 },
    })
  })

  it('registra el faltante cuando el dinero no alcanza', async () => {
    const { servicio, guardarCierre } = armar({ ventas: [venta('a', '2026-11-03', 2)] })
    await servicio.cerrarPeriodo({ tipo: 'diario', desde: '2026-11-03', efectivo: 3000, transferencias: 0 })
    const [datos] = guardarCierre.mock.calls[0] as unknown as [{ resultado: { faltante: number; cuadra: boolean } }]
    expect(datos.resultado).toMatchObject({ cuadra: false, faltante: 2000 })
  })
})

describe('cerrarPeriodo semanal', () => {
  it('calcula la utilidad con el costo de la última compra y guarda los costos usados', async () => {
    const { servicio, guardarCierre } = armar({
      ventas: [venta('a', '2026-11-03', 10), venta('fuera', '2026-11-09', 50)],
    })
    await servicio.cerrarPeriodo({ tipo: 'semanal', desde: '2026-11-02', efectivo: 29000, transferencias: 0 })
    const [datos] = guardarCierre.mock.calls[0] as unknown as [
      { hasta: string; costosUsados: unknown; resultado: { completo: boolean; costoReposicion: number } },
    ]
    // vendido 30000; costo de reponer 10 u × 2000 = 20000
    expect(datos.hasta).toBe('2026-11-08')
    expect(datos.resultado).toMatchObject({ completo: true, costoReposicion: 20000 })
    expect(datos.costosUsados).toEqual([{ productoId: P1, compra: { id: 'c1', fecha: '2026-11-01' } }])
  })

  it('usa los costos manuales para productos sin compras', async () => {
    const { servicio, guardarCierre } = armar({ ventas: [{ ...venta('a', '2026-11-03', 1), renglones: [{ productoId: 'sinCompra', producto, presentacion: 'unidad', cantidad: 1, precioCobrado: 3000 }] }] })
    await servicio.cerrarPeriodo({ tipo: 'semanal', desde: '2026-11-02', efectivo: 3000, transferencias: 0, costosManuales: { sinCompra: 1800 } })
    const [datos] = guardarCierre.mock.calls[0] as unknown as [{ costosManuales: unknown; resultado: { completo: boolean; costoReposicion: number } }]
    expect(datos.resultado).toMatchObject({ completo: true, costoReposicion: 1800 })
    expect(datos.costosManuales).toEqual({ sinCompra: 1800 })
  })

  it('sin costo queda incompleto en vez de tomar cero', async () => {
    const { servicio, guardarCierre } = armar({ ventas: [{ ...venta('a', '2026-11-03', 1), renglones: [{ productoId: 'sinCompra', producto, presentacion: 'unidad', cantidad: 1, precioCobrado: 3000 }] }] })
    await servicio.cerrarPeriodo({ tipo: 'semanal', desde: '2026-11-02', efectivo: 3000, transferencias: 0 })
    const [datos] = guardarCierre.mock.calls[0] as unknown as [{ resultado: { completo: boolean; productosSinCosto: string[] } }]
    expect(datos.resultado).toMatchObject({ completo: false, productosSinCosto: ['sinCompra'] })
  })

  it('rechaza una semana que no empieza en lunes', async () => {
    const { servicio, guardarCierre } = armar()
    await expect(servicio.cerrarPeriodo({ tipo: 'semanal', desde: '2026-11-03', efectivo: 0, transferencias: 0 })).rejects.toThrow(/lunes/i)
    expect(guardarCierre).not.toHaveBeenCalled()
  })
})

describe('recalcularCierre', () => {
  const guardado: CierreLeido = {
    id: 'cierre-1',
    tipo: 'diario',
    desde: '2026-11-03',
    hasta: '2026-11-03',
    calculadoEn: '2026-11-03T23:00:00.000Z',
    efectivo: 4000,
    transferencias: 1000,
    dineroCorregidoEn: null,
    costosManuales: {},
    costosUsados: [],
    resultado: {},
  }

  it('vuelve a calcular con el dinero guardado y los datos vigentes', async () => {
    const { servicio, recalcularCierre } = armar({ ventas: [venta('a', '2026-11-03', 3)], cierres: [guardado] })
    await servicio.recalcularCierre('cierre-1')
    // ahora se vendió 9000; dinero 4000 + 1000 + 1000 = 6000 → faltan 3000
    expect(recalcularCierre).toHaveBeenCalledWith('cierre-1', [], { dineroTotal: 6000, diferencia: -3000, cuadra: false, faltante: 3000, sobrante: 0 })
  })

  it('falla si el cierre no existe', async () => {
    const { servicio, recalcularCierre } = armar({ cierres: [guardado] })
    await expect(servicio.recalcularCierre('otro')).rejects.toThrow(/no existe/i)
    expect(recalcularCierre).not.toHaveBeenCalled()
  })
})
