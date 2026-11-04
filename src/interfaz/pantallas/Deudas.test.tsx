// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Deudas" (lista).
 *
 * Qué hace: verifica pestañas Pendientes/Pagadas/Anuladas, total, búsqueda y
 * accesos a nueva deuda y al detalle.
 * Cómo lo hace: servicios falsos con deudas inventadas.
 * Por qué: es donde se ve quién debe y cuánto.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Deudas, type ServiciosDeudas } from './Deudas'

afterEach(cleanup)

const servicios: ServiciosDeudas = {
  deudas: {
    listarDeudas: async () => [
      { id: 'd1', cliente: 'Ana', fecha: '2026-11-01', monto: 50000, descripcion: 'Fiado de cervezas', estado: 'vigente' },
      { id: 'd2', cliente: 'Beto', fecha: '2026-11-02', monto: 15000, descripcion: 'Fiado', estado: 'vigente' },
      { id: 'd3', cliente: 'Caro', fecha: '2026-10-30', monto: 9000, descripcion: 'Fiado', estado: 'vigente' },
      { id: 'd4', cliente: 'Dani', fecha: '2026-10-29', monto: 7000, descripcion: 'Error', estado: 'anulada' },
    ],
    listarAbonos: async () => [
      { id: 'a1', deudaId: 'd1', fecha: '2026-11-02', monto: 20000, descripcion: 'Pagó', estado: 'vigente' },
      { id: 'a2', deudaId: 'd3', fecha: '2026-11-01', monto: 9000, descripcion: 'Saldó', estado: 'vigente' },
    ],
  },
}

const dibujar = (alIr = vi.fn()) => render(<Deudas servicios={servicios} hoy="2026-11-03" alIr={alIr} />)

describe('Deudas', () => {
  it('muestra las pendientes con saldo y el total', async () => {
    dibujar()
    expect(await screen.findByText('Beto')).toBeTruthy()
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText('$ 45.000', { selector: '.dato__total' })).toBeTruthy()
    expect(screen.getByText('2 cuentas')).toBeTruthy()
    expect(screen.queryByText('Caro')).toBeNull()
  })

  it('cambia de pestaña a pagadas y anuladas', async () => {
    dibujar()
    await screen.findByText('Beto')
    fireEvent.click(screen.getByRole('radio', { name: /Pagadas/ }))
    expect(screen.getByText('Caro')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Anuladas/ }))
    expect(screen.getByText('Dani')).toBeTruthy()
  })

  it('busca por cliente', async () => {
    dibujar()
    await screen.findByText('Beto')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'an' } })
    expect(screen.queryByText('Beto')).toBeNull()
    expect(screen.getByText('Ana')).toBeTruthy()
  })

  it('lleva a nueva deuda y al detalle', async () => {
    const alIr = vi.fn()
    dibujar(alIr)
    await screen.findByText('Beto')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva deuda' }))
    fireEvent.click(screen.getByRole('button', { name: /Beto/ }))
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['deudas/nueva', 'deudas/d2'])
  })

  it('sin deudas lo dice y si falla permite reintentar', async () => {
    render(<Deudas servicios={{ deudas: { listarDeudas: async () => [], listarAbonos: async () => [] } }} hoy="2026-11-03" alIr={vi.fn()} />)
    expect(await screen.findByText(/no hay deudas pendientes/i)).toBeTruthy()
    cleanup()
    render(<Deudas servicios={{ deudas: { listarDeudas: async () => { throw new Error('sin red') }, listarAbonos: async () => [] } }} hoy="2026-11-03" alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })
})
