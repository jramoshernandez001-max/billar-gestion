// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Bitácora".
 *
 * Qué hace: verifica el listado, los filtros por grupo y usuario, "cargar
 * más" y el acceso al detalle.
 * Cómo lo hace: servicio falso con entradas inventadas.
 * Por qué: es el registro de quién cambió qué; debe poder filtrarse.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Bitacora, type ServiciosBitacora } from './Bitacora'
import type { EntradaBitacora } from '../../datos/bitacora'

afterEach(cleanup)

const entrada = (id: string, dia: number, sobre: Partial<EntradaBitacora> = {}): EntradaBitacora => ({
  id, momento: new Date(2026, 10, dia, 10, 0).toISOString(), usuario: 'ana@ejemplo.com', accion: 'registrar-venta', tabla: 'ventas', registroId: 'r', antes: null, despues: {}, motivo: null, ...sobre,
})

const servicios = (entradas: EntradaBitacora[]): ServiciosBitacora => ({ bitacora: { listarBitacora: async () => entradas } })

describe('Bitacora', () => {
  it('lista las entradas con título, usuario y motivo', async () => {
    render(<Bitacora servicios={servicios([entrada('a', 1), entrada('b', 2, { accion: 'anular-registro', tabla: 'compras', motivo: 'duplicada', usuario: 'beto@ejemplo.com' })])} alIr={vi.fn()} />)
    expect(await screen.findByText('Venta registrada')).toBeTruthy()
    expect(screen.getByText('Compra anulada')).toBeTruthy()
    expect(screen.getByText('Motivo: duplicada')).toBeTruthy()
    expect(screen.getAllByText('beto@ejemplo.com').length).toBeGreaterThan(0)
  })

  it('filtra por grupo y por usuario', async () => {
    render(<Bitacora servicios={servicios([entrada('a', 1), entrada('b', 2, { accion: 'registrar-compra', tabla: 'compras', usuario: 'beto@ejemplo.com' })])} alIr={vi.fn()} />)
    await screen.findByText('Venta registrada')
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'compras' } })
    expect(screen.queryByText('Venta registrada')).toBeNull()
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'todos' } })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'ana@ejemplo.com' } })
    expect(screen.queryByText('Compra registrada')).toBeNull()
    expect(screen.getByText('Venta registrada')).toBeTruthy()
  })

  it('carga más de a 20', async () => {
    render(<Bitacora servicios={servicios(Array.from({ length: 25 }, (_, i) => entrada(`e${i}`, 1 + (i % 28), { momento: new Date(2026, 9, 1, 0, i).toISOString() })))} alIr={vi.fn()} />)
    await screen.findByText('20 de 25 movimientos')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(screen.queryByText(/de 25 movimientos/)).toBeNull()
  })

  it('una entrada lleva a su detalle', async () => {
    const alIr = vi.fn()
    render(<Bitacora servicios={servicios([entrada('a', 1)])} alIr={alIr} />)
    fireEvent.click(await screen.findByRole('button', { name: /Venta registrada/ }))
    expect(alIr).toHaveBeenCalledWith('mas/bitacora/a')
  })

  it('sin movimientos lo dice y si falla permite reintentar', async () => {
    render(<Bitacora servicios={servicios([])} alIr={vi.fn()} />)
    expect(await screen.findByText(/no hay movimientos/i)).toBeTruthy()
    cleanup()
    render(<Bitacora servicios={{ bitacora: { listarBitacora: async () => { throw new Error('sin red') } } }} alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })
})
