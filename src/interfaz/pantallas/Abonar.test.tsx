// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Abonar".
 *
 * Qué hace: verifica el saldo, el aviso de monto inválido (mayor al saldo o
 * cero), el guardado y el error del servidor.
 * Cómo lo hace: servicios falsos con una deuda inventada.
 * Por qué: la base rechaza un abono de más; la pantalla lo avisa antes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Abonar, type ServiciosAbonar } from './Abonar'

afterEach(cleanup)

function servicios(registrarAbono = vi.fn(async () => 'a')): ServiciosAbonar {
  return {
    deudas: {
      listarDeudas: async () => [{ id: 'd1', cliente: 'Ana', fecha: '2026-11-01', monto: 50000, descripcion: 'Fiado', estado: 'vigente' as const }],
      listarAbonos: async () => [{ id: 'a1', deudaId: 'd1', fecha: '2026-11-02', monto: 20000, descripcion: 'Pagó', estado: 'vigente' as const }],
      registrarAbono,
    },
  }
}

const dibujar = (s: ServiciosAbonar, alIr = vi.fn(), deudaId = 'd1') => render(<Abonar servicios={s} deudaId={deudaId} hoy="2026-11-03" alIr={alIr} />)

describe('Abonar', () => {
  it('muestra cliente y saldo actual', async () => {
    dibujar(servicios())
    expect(await screen.findByText('Ana')).toBeTruthy()
    expect(screen.getByText('$ 30.000', { selector: '.dato__total' })).toBeTruthy()
  })

  it('un monto mayor al saldo muestra el error y no deja guardar', async () => {
    dibujar(servicios())
    await screen.findByText('Ana')
    fireEvent.change(screen.getByLabelText('Monto del abono'), { target: { value: '31000' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Pagó' } })
    expect(screen.getByText(/supera lo que se debe/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Registrar abono' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('registra el abono y vuelve al detalle', async () => {
    const registrarAbono = vi.fn(async () => 'a')
    const alIr = vi.fn()
    dibujar(servicios(registrarAbono), alIr)
    await screen.findByText('Ana')
    fireEvent.change(screen.getByLabelText('Monto del abono'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Pagó en efectivo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('deudas/d1'))
    expect(registrarAbono).toHaveBeenCalledWith({ deudaId: 'd1', fecha: '2026-11-03', monto: 10000, descripcion: 'Pagó en efectivo' })
  })

  it('muestra el error del servidor', async () => {
    dibujar(servicios(vi.fn(async () => { throw new Error('la deuda ya está pagada') })))
    await screen.findByText('Ana')
    fireEvent.change(screen.getByLabelText('Monto del abono'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Pagó' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya está pagada/)
  })

  it('una deuda pagada o inexistente no recibe abonos', async () => {
    dibujar(servicios(), vi.fn(), 'otra')
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })
})
