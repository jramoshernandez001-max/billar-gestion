// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Nueva compra".
 *
 * Qué hace: verifica el precio por presentación, el total calculado, varios
 * productos en una sola compra, el registro y los errores.
 * Cómo lo hace: servicios falsos con productos inventados.
 * Por qué: un costo mal registrado cambia la utilidad semanal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Comprar, type ServiciosComprar } from './Comprar'

afterEach(cleanup)

const productos = [
  { id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 },
  { id: 'p2', nombre: 'Agua Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 },
]

function servicios(sobre: Partial<ServiciosComprar['inventario']> = {}): ServiciosComprar {
  return { inventario: { listarProductos: async () => productos, registrarCompras: vi.fn(async () => undefined), ...sobre } }
}

const dibujar = (s: ServiciosComprar, productoId: string | undefined, alIr = vi.fn()) =>
  render(<Comprar servicios={s} productoId={productoId} hoy="2026-11-03" alIr={alIr} />)

describe('Comprar', () => {
  it('sin producto pide elegir y no deja registrar', async () => {
    dibujar(servicios(), undefined)
    await screen.findByText('Nueva compra')
    expect((screen.getByRole('button', { name: 'Registrar compra' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('viene con el producto de la ruta y pide el precio por caja', async () => {
    dibujar(servicios(), 'p1')
    await screen.findByText('Nueva compra')
    expect((screen.getByLabelText('Producto 1') as HTMLSelectElement).value).toBe('p1')
    expect(screen.getByLabelText('Precio por caja · renglón 1')).toBeTruthy()
  })

  it('con el precio por caja calcula el total pagado y el costo por unidad', async () => {
    dibujar(servicios(), 'p1')
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByLabelText('Más cantidad · renglón 1'))
    fireEvent.change(screen.getByLabelText('Precio por caja · renglón 1'), { target: { value: '48000' } })
    expect(screen.getByText('2 cajas × 24 unidades')).toBeTruthy()
    expect(screen.getByText(/\$ 2\.000 por unidad/)).toBeTruthy()
    expect(screen.getAllByText('$ 96.000').length).toBeGreaterThan(0)
  })

  it('sixpack aparece tachado si el producto no lo maneja; al elegir sixpack pide el precio del sixpack', async () => {
    dibujar(servicios(), 'p2')
    await screen.findByText('Nueva compra')
    expect((screen.getByRole('radio', { name: 'Sixpack' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Producto 1'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Sixpack' }))
    expect(screen.getByLabelText('Precio por sixpack · renglón 1')).toBeTruthy()
  })

  it('registra varios productos con un solo botón y va al historial', async () => {
    const s = servicios()
    const alIr = vi.fn()
    dibujar(s, 'p1', alIr)
    await screen.findByText('Nueva compra')
    fireEvent.change(screen.getByLabelText('Precio por caja · renglón 1'), { target: { value: '74000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    fireEvent.change(screen.getByLabelText('Producto 2'), { target: { value: 'p2' } })
    fireEvent.click(screen.getByLabelText('Más cantidad · renglón 2'))
    fireEvent.change(screen.getByLabelText('Precio por caja · renglón 2'), { target: { value: '15000' } })
    expect(screen.getByText('$ 104.000')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/compras'))
    expect(s.inventario.registrarCompras).toHaveBeenCalledWith({
      fecha: '2026-11-03',
      renglones: [
        { productoId: 'p1', presentacion: 'caja', cantidad: 1, costoTotal: 74000 },
        { productoId: 'p2', presentacion: 'caja', cantidad: 2, costoTotal: 30000 },
      ],
    })
  })

  it('se puede quitar un producto de la compra', async () => {
    dibujar(servicios(), 'p1')
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    expect(screen.getByLabelText('Producto 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar producto 2' }))
    expect(screen.queryByLabelText('Producto 2')).toBeNull()
  })

  it('si falta un precio dice en qué renglón y no deja registrar', async () => {
    dibujar(servicios(), 'p1')
    await screen.findByText('Nueva compra')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }))
    fireEvent.change(screen.getByLabelText('Precio por caja · renglón 1'), { target: { value: '74000' } })
    expect(screen.getByText(/Renglón 2: Elige un producto/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Registrar compra' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('si falla el registro muestra el error y no navega', async () => {
    const alIr = vi.fn()
    dibujar(servicios({ registrarCompras: async () => { throw new Error('sin permisos') } }), 'p1', alIr)
    await screen.findByText('Nueva compra')
    fireEvent.change(screen.getByLabelText('Precio por caja · renglón 1'), { target: { value: '5000' } })
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

  it('un licor se compra por botella: solo esa opción y se registra como unidad', async () => {
    const licor = { id: 'p3', nombre: 'Aguardiente Ejemplo', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false, precioUnidad: 50000, precioCaja: 50000 }
    const s = servicios({ listarProductos: async () => [...productos, licor] })
    dibujar(s, 'p3')
    await screen.findByText('Nueva compra')
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Botella'])
    fireEvent.change(screen.getByLabelText('Precio por botella · renglón 1'), { target: { value: '30000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    await waitFor(() => expect(s.inventario.registrarCompras).toHaveBeenCalled())
    expect(s.inventario.registrarCompras).toHaveBeenCalledWith({
      fecha: '2026-11-03',
      renglones: [{ productoId: 'p3', presentacion: 'unidad', cantidad: 1, costoTotal: 30000 }],
    })
  })
})
