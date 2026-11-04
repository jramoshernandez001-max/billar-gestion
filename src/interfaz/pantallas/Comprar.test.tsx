// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Nueva compra".
 *
 * Qué hace: verifica el panel de cálculo, la presentación, el registro y los
 * errores.
 * Cómo lo hace: servicios falsos con productos inventados.
 * Por qué: un costo mal registrado cambia la utilidad semanal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Comprar, type ServiciosComprar } from './Comprar'

afterEach(cleanup)

const productos = [
  { id: 'p1', nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
  { id: 'p2', nombre: 'Agua Ejemplo', unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 },
]

function servicios(sobre: Partial<ServiciosComprar['inventario']> = {}): ServiciosComprar {
  return { inventario: { listarProductos: async () => productos, registrarCompra: vi.fn(async () => 'c1'), ...sobre } }
}

const dibujar = (s: ServiciosComprar, productoId: string | undefined, alIr = vi.fn()) =>
  render(<Comprar servicios={s} productoId={productoId} hoy="2026-11-03" alIr={alIr} />)

describe('Comprar', () => {
  it('sin producto pide elegir y no deja registrar', async () => {
    dibujar(servicios(), undefined)
    await screen.findByText('Nueva compra')
    expect((screen.getByRole('button', { name: 'Registrar compra' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('elegir un producto cambia la ruta', async () => {
    const alIr = vi.fn()
    dibujar(servicios(), undefined, alIr)
    await screen.findByText('Nueva compra')
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'p1' } })
    expect(alIr).toHaveBeenCalledWith('inventario/comprar/p1')
  })

  it('muestra el panel con unidades y costo por unidad', async () => {
    dibujar(servicios(), 'p1')
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByRole('radio', { name: 'Caja' }))
    fireEvent.click(screen.getByLabelText('Más cantidad'))
    fireEvent.change(screen.getByLabelText('Costo total'), { target: { value: '96000' } })
    expect(screen.getByText('2 cajas × 24 unidades')).toBeTruthy()
    expect(screen.getByText('48 unidades')).toBeTruthy()
    expect(screen.getByText('$ 2.000')).toBeTruthy()
    expect(screen.getByText('Al registrar se sumarán 48 unidades de Cerveza Ejemplo.')).toBeTruthy()
  })

  it('sixpack aparece tachado si el producto no lo maneja', async () => {
    dibujar(servicios(), 'p2')
    await screen.findByText('Nueva compra')
    expect((screen.getByRole('radio', { name: 'Sixpack' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('registra la compra y va al historial', async () => {
    const s = servicios()
    const alIr = vi.fn()
    dibujar(s, 'p1', alIr)
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByRole('radio', { name: 'Caja' }))
    fireEvent.click(screen.getByLabelText('Más cantidad'))
    fireEvent.change(screen.getByLabelText('Costo total'), { target: { value: '96000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/compras'))
    expect(s.inventario.registrarCompra).toHaveBeenCalledWith({ productoId: 'p1', presentacion: 'caja', cantidad: 2, costoTotal: 96000, fecha: '2026-11-03' })
  })

  it('si falla el registro muestra el error y no navega', async () => {
    const alIr = vi.fn()
    dibujar(servicios({ registrarCompra: async () => { throw new Error('sin permisos') } }), 'p1', alIr)
    await screen.findByText('Nueva compra')
    fireEvent.change(screen.getByLabelText('Costo total'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin permisos/)
    expect(alIr).not.toHaveBeenCalled()
  })

  it('el enlace lleva al historial', async () => {
    const alIr = vi.fn()
    dibujar(servicios(), 'p1', alIr)
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial de compras' }))
    expect(alIr).toHaveBeenCalledWith('mas/compras')
  })
})
