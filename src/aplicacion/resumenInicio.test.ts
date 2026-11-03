/**
 * Pruebas del resumen de la pantalla de inicio.
 *
 * Qué hace: verifica las ventas de hoy, la serie de ventas de los últimos 7
 * días (para el gráfico de barras) y el conteo de avisos.
 * Cómo lo hace: ventas inventadas con números hechos a mano.
 * Por qué: el inicio es lo primero que se ve; un total equivocado o un día
 * faltante en el gráfico se notaría en seguida.
 */
import { describe, it, expect } from 'vitest'
import { resumirInicio } from './resumenInicio'
import type { Venta } from '../domain/ventas/venta'

const producto = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const venta = (id: string, fecha: string, cantidad: number, estado: Venta['estado'] = 'vigente'): Venta => ({
  id, fecha, estado,
  renglones: [{ productoId: 'p', producto, presentacion: 'unidad', cantidad, precioCobrado: 3000 }],
})

describe('resumirInicio', () => {
  const ventas = [
    venta('a', '2026-11-03', 2),
    venta('b', '2026-11-03', 1),
    venta('c', '2026-11-03', 9, 'anulada'),
    venta('d', '2026-11-01', 4),
    venta('e', '2026-10-20', 7),
  ]

  it('suma las ventas vigentes de hoy y cuenta cuántas son', () => {
    const r = resumirInicio({ hoy: '2026-11-03', ventas, deudaPendiente: 0, productosNegativos: 0, cierresDesactualizados: 0 })
    expect(r.hoy).toEqual({ total: 9000, cantidadVentas: 2 })
  })

  it('arma la serie de 7 días terminando hoy, con ceros en los días sin ventas', () => {
    const r = resumirInicio({ hoy: '2026-11-03', ventas, deudaPendiente: 0, productosNegativos: 0, cierresDesactualizados: 0 })
    expect(r.ultimosDias.map((d) => d.fecha)).toEqual([
      '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03',
    ])
    expect(r.ultimosDias.map((d) => d.total)).toEqual([0, 0, 0, 0, 12000, 0, 9000])
  })

  it('un día sin ventas hoy da cero', () => {
    const r = resumirInicio({ hoy: '2026-11-05', ventas, deudaPendiente: 0, productosNegativos: 0, cierresDesactualizados: 0 })
    expect(r.hoy).toEqual({ total: 0, cantidadVentas: 0 })
  })

  it('cuenta los avisos', () => {
    const r = resumirInicio({ hoy: '2026-11-03', ventas: [], deudaPendiente: 45000, productosNegativos: 2, cierresDesactualizados: 1 })
    expect(r.avisos).toEqual({ deudaPendiente: 45000, productosNegativos: 2, cierresDesactualizados: 1 })
  })

  it('rechaza una fecha de hoy inválida', () => {
    expect(() => resumirInicio({ hoy: 'hoy', ventas: [], deudaPendiente: 0, productosNegativos: 0, cierresDesactualizados: 0 })).toThrow()
  })
})
