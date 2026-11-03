/**
 * Pruebas de la anulación de una compra.
 *
 * Qué hace: verifica que anular una compra cambie su estado, deje el
 * registro de anulación en la bitácora y devuelva el movimiento inverso que
 * saca de la bodega lo que la compra había metido.
 * Cómo lo hace: anula compras de ejemplo inventadas y revisa la compra, el
 * registro, el stock resultante y las validaciones.
 * Por qué: nada se borra; una compra mal registrada se anula, y el
 * inventario debe volver a cuadrar.
 */
import { describe, it, expect } from 'vitest'
import { anularCompra } from './anulacionCompra'
import { compraAMovimiento, ultimaCompraDe, type Compra } from './compras'
import { calcularStock } from './stock'

const momento = new Date('2026-03-12T21:00:00.000Z')

const compra: Compra = {
  id: 'c1',
  productoId: 'cerveza-a',
  producto: { unidadesPorCaja: 20, manejaSixpack: false },
  presentacion: 'caja',
  cantidad: 2,
  costoTotal: 50000,
  fecha: '2026-03-10',
  registradoEn: '2026-03-10T15:00:00.000Z',
  estado: 'vigente',
}

describe('anularCompra', () => {
  it('cambia el estado a anulada y deja lo demás igual', () => {
    const { compra: anulada } = anularCompra({ compra, motivo: 'Compra repetida', usuario: 'a@example.com', momento })
    expect(anulada).toEqual({ ...compra, estado: 'anulada' })
    expect(compra.estado).toBe('vigente')
  })

  it('deja el registro de anulación con antes, después y motivo', () => {
    const { compra: anulada, registro } = anularCompra({ compra, motivo: 'Compra repetida', usuario: 'a@example.com', momento })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-12T21:00:00.000Z',
      accion: 'anular-registro',
      motivo: 'Compra repetida',
      antes: compra,
      despues: anulada,
    })
  })

  it('devuelve el movimiento inverso que deja la bodega como estaba', () => {
    const { movimientos } = anularCompra({ compra, motivo: 'error', usuario: 'a@example.com', momento })
    const historial = [compraAMovimiento(compra), ...movimientos]
    expect(calcularStock(historial, 'cerveza-a')).toEqual({ bodega: 0, nevera: 0, total: 0 })
  })

  it('la compra anulada ya no cuenta como última compra', () => {
    const anterior: Compra = { ...compra, id: 'c0', fecha: '2026-03-01', costoTotal: 48000 }
    const { compra: anulada } = anularCompra({ compra, motivo: 'error', usuario: 'a@example.com', momento })
    expect(ultimaCompraDe([anterior, anulada], 'cerveza-a')?.id).toBe('c0')
  })

  it('rechaza anular una compra que ya está anulada', () => {
    expect(() =>
      anularCompra({ compra: { ...compra, estado: 'anulada' }, motivo: 'error', usuario: 'a@example.com', momento }),
    ).toThrow(/ya está anulada/i)
  })

  it('exige un motivo', () => {
    expect(() => anularCompra({ compra, motivo: '  ', usuario: 'a@example.com', momento })).toThrow(/motivo/i)
  })
})
