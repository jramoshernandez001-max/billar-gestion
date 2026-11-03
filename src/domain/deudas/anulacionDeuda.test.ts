/**
 * Pruebas de la anulación de deudas y abonos.
 *
 * Qué hace: verifica que anular una deuda o un abono cambie su estado y deje
 * el registro de anulación, y que una deuda con abonos vigentes no se pueda
 * anular.
 * Cómo lo hace: anula deudas y abonos de ejemplo inventados y revisa el
 * resultado, el registro y las validaciones.
 * Por qué: nada se borra. Si una deuda con abonos vigentes se anulara, esos
 * pagos quedarían colgando de una deuda que ya no cuenta.
 */
import { describe, it, expect } from 'vitest'
import { anularAbono, anularDeuda } from './anulacionDeuda'
import type { Abono, Deuda } from './deudas'

const momento = new Date('2026-03-12T22:00:00.000Z')

const deuda: Deuda = {
  id: 'd1',
  cliente: 'Cliente de ejemplo',
  fecha: '2026-03-10',
  monto: 20000,
  descripcion: 'Ronda fiada',
  estado: 'vigente',
}

const abono: Abono = {
  id: 'a1',
  deudaId: 'd1',
  fecha: '2026-03-11',
  monto: 5000,
  descripcion: 'Abono en efectivo',
  estado: 'vigente',
}

describe('anularDeuda', () => {
  it('sin abonos, cambia el estado y deja el registro con motivo', () => {
    const { deuda: anulada, registro } = anularDeuda({ deuda, abonos: [], motivo: 'Se registró a otro cliente', usuario: 'a@example.com', momento })
    expect(anulada).toEqual({ ...deuda, estado: 'anulada' })
    expect(registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-12T22:00:00.000Z',
      accion: 'anular-registro',
      motivo: 'Se registró a otro cliente',
      antes: deuda,
      despues: anulada,
    })
  })

  it('con abonos vigentes no se puede anular: pide anular primero los abonos', () => {
    expect(() => anularDeuda({ deuda, abonos: [abono], motivo: 'error', usuario: 'a@example.com', momento })).toThrow(
      /anule primero los abonos/i,
    )
  })

  it('con abonos ya anulados sí se puede anular', () => {
    const { deuda: anulada } = anularDeuda({
      deuda,
      abonos: [{ ...abono, estado: 'anulada' }],
      motivo: 'error',
      usuario: 'a@example.com',
      momento,
    })
    expect(anulada.estado).toBe('anulada')
  })

  it('los abonos vigentes de otras deudas no impiden anular', () => {
    const deOtra = { ...abono, id: 'a9', deudaId: 'd9' }
    expect(() => anularDeuda({ deuda, abonos: [deOtra], motivo: 'error', usuario: 'a@example.com', momento })).not.toThrow()
  })

  it('rechaza anular una deuda ya anulada y exige motivo', () => {
    expect(() =>
      anularDeuda({ deuda: { ...deuda, estado: 'anulada' }, abonos: [], motivo: 'error', usuario: 'a@example.com', momento }),
    ).toThrow(/ya está anulada/i)
    expect(() => anularDeuda({ deuda, abonos: [], motivo: ' ', usuario: 'a@example.com', momento })).toThrow(/motivo/i)
  })
})

describe('anularAbono', () => {
  it('cambia el estado y deja el registro con motivo', () => {
    const { abono: anulado, registro } = anularAbono({ abono, motivo: 'Abono repetido', usuario: 'a@example.com', momento })
    expect(anulado).toEqual({ ...abono, estado: 'anulada' })
    expect(registro.accion).toBe('anular-registro')
    expect(registro.antes).toEqual(abono)
    expect(registro.despues).toEqual(anulado)
    expect(registro.motivo).toBe('Abono repetido')
  })

  it('rechaza anular un abono ya anulado y exige motivo', () => {
    expect(() =>
      anularAbono({ abono: { ...abono, estado: 'anulada' }, motivo: 'error', usuario: 'a@example.com', momento }),
    ).toThrow(/ya está anulado/i)
    expect(() => anularAbono({ abono, motivo: '', usuario: 'a@example.com', momento })).toThrow(/motivo/i)
  })
})
