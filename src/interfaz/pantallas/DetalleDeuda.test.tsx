// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Detalle de deuda".
 *
 * Qué hace: verifica datos, abonos, acciones según el estado y la anulación
 * (de la deuda y de un abono) con motivo.
 * Cómo lo hace: servicios falsos con una deuda inventada.
 * Por qué: nada se borra; anular exige motivo y una deuda con abonos
 * vigentes no se puede anular.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DetalleDeuda, type ServiciosDetalleDeuda } from './DetalleDeuda'

afterEach(cleanup)

const deuda = (id: string, estado: 'vigente' | 'anulada' = 'vigente') => ({ id, cliente: 'Ana', fecha: '2026-11-01', monto: 50000, descripcion: 'Fiado de cervezas', estado })

function servicios(conAbono: boolean, anularDeuda = vi.fn(async () => undefined), anularAbono = vi.fn(async () => undefined)): ServiciosDetalleDeuda {
  return {
    deudas: {
      listarDeudas: async () => [deuda('d1'), deuda('d2', 'anulada')],
      listarAbonos: async () => (conAbono ? [{ id: 'a1', deudaId: 'd1', fecha: '2026-11-02', monto: 20000, descripcion: 'Pagó en efectivo', estado: 'vigente' as const }] : []),
      anularDeuda,
      anularAbono,
    },
    bitacora: {
      listarBitacora: async () => [
        { id: 'b', momento: new Date(2026, 10, 3, 9, 0).toISOString(), usuario: 'a@x.com', accion: 'anular-registro' as const, tabla: 'deudas', registroId: 'd2', antes: null, despues: {}, motivo: 'monto equivocado' },
      ],
    },
  }
}

const dibujar = (s: ServiciosDetalleDeuda, deudaId = 'd1', alIr = vi.fn()) => render(<DetalleDeuda servicios={s} deudaId={deudaId} hoy="2026-11-03" alIr={alIr} />)

describe('DetalleDeuda', () => {
  it('muestra cliente, descripción, saldo y abonos', async () => {
    dibujar(servicios(true))
    expect(await screen.findByText('Ana')).toBeTruthy()
    expect(screen.getByText('Fiado de cervezas')).toBeTruthy()
    expect(screen.getByText('$ 30.000', { selector: '.dato__total' })).toBeTruthy()
    expect(screen.getByText('Pagó en efectivo')).toBeTruthy()
  })

  it('abonar lleva a la pantalla de abono', async () => {
    const alIr = vi.fn()
    dibujar(servicios(true), 'd1', alIr)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Abonar' }))
    expect(alIr).toHaveBeenCalledWith('deudas/abonar/d1')
  })

  it('con abonos vigentes no ofrece anular la deuda, pero sí el abono', async () => {
    dibujar(servicios(true))
    await screen.findByText('Ana')
    expect(screen.queryByRole('button', { name: 'Anular deuda' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Anular abono' })).toBeTruthy()
  })

  it('anula la deuda con motivo y vuelve a la lista', async () => {
    const anularDeuda = vi.fn(async () => undefined)
    const alIr = vi.fn()
    dibujar(servicios(false, anularDeuda), 'd1', alIr)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Anular deuda' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar anulación' }) as HTMLButtonElement
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: ' monto equivocado ' } })
    fireEvent.click(confirmar)
    await waitFor(() => expect(anularDeuda).toHaveBeenCalledWith('d1', 'monto equivocado'))
    expect(alIr).toHaveBeenCalledWith('deudas')
  })

  it('anula un abono con motivo y recarga', async () => {
    const anularAbono = vi.fn(async () => undefined)
    dibujar(servicios(true, undefined, anularAbono))
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Anular abono' }))
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: 'duplicado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    await waitFor(() => expect(anularAbono).toHaveBeenCalledWith('a1', 'duplicado'))
  })

  it('una deuda anulada muestra el motivo y no tiene acciones', async () => {
    dibujar(servicios(false), 'd2')
    expect(await screen.findByText('Motivo: monto equivocado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abonar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anular deuda' })).toBeNull()
  })

  it('una deuda que no existe avisa', async () => {
    dibujar(servicios(false), 'otra')
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })
})
