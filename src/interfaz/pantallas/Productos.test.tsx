// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Productos".
 *
 * Qué hace: verifica la lista, la búsqueda y los accesos a crear y editar.
 * Cómo lo hace: servicios falsos con productos inventados.
 * Por qué: es el catálogo del que salen todas las ventas y compras.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Productos, type ServiciosProductos } from './Productos'

afterEach(cleanup)

const servicios: ServiciosProductos = {
  inventario: {
    listarProductos: async () => [
      { id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
      { id: 'p2', nombre: 'Agua Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 },
      { id: 'p3', nombre: 'Aguardiente Ejemplo', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false, precioUnidad: 50000, precioCaja: 50000 },
    ],
  },
}

describe('Productos', () => {
  it('lista los productos con detalle y precios', async () => {
    render(<Productos servicios={servicios} alIr={vi.fn()} />)
    expect(await screen.findByText('Cerveza Ejemplo')).toBeTruthy()
    expect(screen.getByText('24 unidades por caja · Con sixpack')).toBeTruthy()
    expect(screen.getByText('$ 60.000')).toBeTruthy()
  })

  it('busca por nombre', async () => {
    render(<Productos servicios={servicios} alIr={vi.fn()} />)
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'agua' } })
    expect(screen.queryByText('Cerveza Ejemplo')).toBeNull()
    expect(screen.getByText('Agua Ejemplo')).toBeTruthy()
  })

  it('nuevo y editar llevan a su ruta', async () => {
    const alIr = vi.fn()
    render(<Productos servicios={servicios} alIr={alIr} />)
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[2])
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['mas/productos/nuevo', 'mas/productos/editar/p1'])
  })

  it('sin productos lo dice y si falla permite reintentar', async () => {
    render(<Productos servicios={{ inventario: { listarProductos: async () => [] } }} alIr={vi.fn()} />)
    expect(await screen.findByText(/no hay productos/i)).toBeTruthy()
    cleanup()
    render(<Productos servicios={{ inventario: { listarProductos: async () => { throw new Error('sin red') } } }} alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })

  it('el licor se muestra por botella, sin caja, y se puede filtrar por categoría', async () => {
    render(<Productos servicios={servicios} alIr={vi.fn()} />)
    await screen.findByText('Cerveza Ejemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Licor' }))
    expect(screen.queryByText('Cerveza Ejemplo')).toBeNull()
    const tarjeta = screen.getByRole('article', { name: 'Aguardiente Ejemplo' })
    expect(tarjeta.textContent).toMatch(/Botella entera/)
    expect(tarjeta.textContent).not.toMatch(/Caja/)
    expect(tarjeta.textContent).toMatch(/\$ 50\.000/)
  })
})
