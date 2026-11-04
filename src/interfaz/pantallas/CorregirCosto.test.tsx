// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Corregir costo".
 *
 * Qué hace: verifica el costo actual, el cálculo de la diferencia, el guardado
 * y los casos que lo impiden (igual al actual, compra anulada o inexistente).
 * Cómo lo hace: servicios falsos con una compra inventada.
 * Por qué: corregir el costo cambia la utilidad si era la última compra.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CorregirCosto, type ServiciosCorregirCosto } from './CorregirCosto'

afterEach(cleanup)

const compra = (estado: 'vigente' | 'anulada') => ({
  id: 'c1', productoId: 'p1', producto: { unidadesPorCaja: 24, manejaSixpack: true }, presentacion: 'caja' as const, cantidad: 2,
  costoTotal: 96000, fecha: '2026-11-02', registradoEn: '2026-11-02T15:00:00.000Z', estado,
})

function servicios(estado: 'vigente' | 'anulada' = 'vigente', corregir = vi.fn(async () => undefined)): ServiciosCorregirCosto {
  return {
    inventario: {
      listarCompras: async () => [compra(estado)],
      listarProductos: async () => [{ id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }],
      corregirCostoCompra: corregir,
    },
  }
}

const dibujar = (s: ServiciosCorregirCosto, compraId = 'c1', alIr = vi.fn()) =>
  render(<CorregirCosto servicios={s} compraId={compraId} alIr={alIr} />)

describe('CorregirCosto', () => {
  it('muestra la compra y su costo actual', async () => {
    dibujar(servicios())
    expect(await screen.findByText('Cerveza Ejemplo')).toBeTruthy()
    expect(screen.getByText('2 cajas · 48 unidades')).toBeTruthy()
    expect(screen.getByText('$ 96.000')).toBeTruthy()
  })

  it('calcula costo por unidad y diferencia', async () => {
    dibujar(servicios())
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.change(screen.getByLabelText('Costo total nuevo'), { target: { value: '100800' } })
    expect(screen.getByText('$ 2.100')).toBeTruthy()
    expect(screen.getByText('+$ 4.800')).toBeTruthy()
  })

  it('guarda el costo nuevo y vuelve al historial', async () => {
    const corregir = vi.fn(async () => undefined)
    const alIr = vi.fn()
    dibujar(servicios('vigente', corregir), 'c1', alIr)
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.change(screen.getByLabelText('Costo total nuevo'), { target: { value: '90000' } })
    const guardar = screen.getByRole('button', { name: 'Guardar corrección' }) as HTMLButtonElement
    expect(guardar.disabled).toBe(true) // falta el motivo
    fireEvent.change(screen.getByLabelText('Motivo de corrección'), { target: { value: ' precio mal digitado ' } })
    fireEvent.click(guardar)
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/compras'))
    expect(corregir).toHaveBeenCalledWith('c1', 90000, 'precio mal digitado')
  })

  it('un costo igual al actual no se puede guardar', async () => {
    dibujar(servicios())
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.change(screen.getByLabelText('Costo total nuevo'), { target: { value: '96000' } })
    fireEvent.change(screen.getByLabelText('Motivo de corrección'), { target: { value: 'x' } })
    expect((screen.getByRole('button', { name: 'Guardar corrección' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('una compra anulada no se corrige', async () => {
    dibujar(servicios('anulada'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/anulada/i)
    expect(screen.queryByRole('button', { name: 'Guardar corrección' })).toBeNull()
  })

  it('una compra que no existe avisa', async () => {
    dibujar(servicios(), 'otra')
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })
})
