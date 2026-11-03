/**
 * Pruebas de la anulación de una venta.
 *
 * Qué hace: verifica que anular una venta cambie su estado a anulada, deje
 * el registro en la bitácora con antes y después y devuelva los movimientos
 * que regresan el producto a la nevera.
 * Cómo lo hace: anula ventas de ejemplo inventadas y revisa la venta, el
 * registro, los movimientos y las validaciones.
 * Por qué: nada se borra; una venta mal registrada se anula, y la nevera
 * debe recuperar las unidades que la venta había descontado.
 */
import { describe, it, expect } from 'vitest'
import { calcularStock } from '../inventario/stock'
import { anularVenta } from './anulacionVenta'
import { ventaAMovimientos } from './movimientosVenta'
import type { Venta } from './venta'

const cervezaA = { unidadesPorCaja: 20, manejaSixpack: false, precioUnidad: 2000, precioCaja: 38000 }
const momento = new Date('2026-03-12T23:30:00.000Z')

const venta: Venta = {
  id: 'v1',
  fecha: '2026-03-12',
  estado: 'vigente',
  renglones: [{ productoId: 'cerveza-a', producto: cervezaA, presentacion: 'unidad', cantidad: 3 }],
}

describe('anularVenta', () => {
  it('cambia el estado a anulada y deja lo demás igual', () => {
    const { venta: anulada } = anularVenta({ venta, motivo: 'Se registró dos veces', usuario: 'a@example.com', momento })
    expect(anulada).toEqual({ ...venta, estado: 'anulada' })
  })

  it('no modifica la venta original', () => {
    anularVenta({ venta, motivo: 'error', usuario: 'a@example.com', momento })
    expect(venta.estado).toBe('vigente')
  })

  it('deja el registro de anulación con antes, después y motivo', () => {
    const { venta: anulada, registro } = anularVenta({ venta, motivo: 'Se registró dos veces', usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-12T23:30:00.000Z',
      accion: 'anular-registro',
      motivo: 'Se registró dos veces',
      antes: venta,
      despues: anulada,
    })
  })

  it('devuelve los movimientos que regresan las unidades a la nevera', () => {
    const { movimientos } = anularVenta({ venta, motivo: 'error', usuario: 'a@example.com', momento })
    const historial = [...ventaAMovimientos(venta.renglones), ...movimientos]
    expect(calcularStock(historial, 'cerveza-a').nevera).toBe(0)
  })

  it('rechaza anular una venta que ya está anulada', () => {
    expect(() =>
      anularVenta({ venta: { ...venta, estado: 'anulada' }, motivo: 'error', usuario: 'a@example.com', momento }),
    ).toThrow(/ya está anulada/i)
  })

  it('exige un motivo', () => {
    expect(() => anularVenta({ venta, motivo: ' ', usuario: 'a@example.com', momento })).toThrow(/motivo/i)
  })
})
