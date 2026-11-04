// @vitest-environment jsdom
/**
 * Pruebas del formulario de producto (crear y editar).
 *
 * Qué hace: verifica los campos, los mensajes de validación, el guardado al
 * crear o editar y los errores del servidor.
 * Cómo lo hace: servicios falsos con productos inventados.
 * Por qué: un precio o un nombre mal guardado afecta todas las ventas nuevas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormularioProducto, type ServiciosFormularioProducto } from './FormularioProducto'

afterEach(cleanup)

const existente = { id: 'p1', nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }

function servicios(sobre: Partial<ServiciosFormularioProducto['inventario']> = {}): ServiciosFormularioProducto {
  return {
    inventario: {
      listarProductos: async () => [existente, { ...existente, id: 'p2', nombre: 'Agua Ejemplo' }],
      crearProducto: vi.fn(async () => 'nuevo'),
      editarProducto: vi.fn(async () => undefined),
      ...sobre,
    },
  }
}

const llenar = (nombre: string) => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: nombre } })
  fireEvent.change(screen.getByLabelText('Unidades por caja'), { target: { value: '30' } })
  fireEvent.change(screen.getByLabelText('Precio de la unidad'), { target: { value: '3500' } })
  fireEvent.change(screen.getByLabelText('Precio de la caja'), { target: { value: '90000' } })
}

describe('FormularioProducto', () => {
  it('crea un producto y vuelve a la lista', async () => {
    const s = servicios()
    const alIr = vi.fn()
    render(<FormularioProducto servicios={s} alIr={alIr} />)
    await screen.findByRole('heading', { name: 'Nuevo producto' })
    llenar('Águila')
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('mas/productos'))
    expect(s.inventario.crearProducto).toHaveBeenCalledWith({ nombre: 'Águila', unidadesPorCaja: 30, manejaSixpack: true, precioUnidad: 3500, precioCaja: 90000 })
  })

  it('no deja guardar con errores y los muestra junto al campo', async () => {
    render(<FormularioProducto servicios={servicios()} alIr={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Nuevo producto' })
    llenar('agua  ejemplo')
    expect(screen.getByText('Ya existe un producto con ese nombre')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Guardar producto' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('edita: carga los datos, permite conservar su nombre y guarda por id', async () => {
    const s = servicios()
    const alIr = vi.fn()
    render(<FormularioProducto servicios={s} productoId="p1" volverA="inventario" alIr={alIr} />)
    await screen.findByRole('heading', { name: 'Editar producto' })
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Cerveza Ejemplo')
    fireEvent.change(screen.getByLabelText('Precio de la unidad'), { target: { value: '3200' } })
    expect(screen.getByText(/no altera las ventas pasadas/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('inventario'))
    expect(s.inventario.editarProducto).toHaveBeenCalledWith('p1', { nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3200, precioCaja: 60000 })
  })

  it('un producto que no existe avisa', async () => {
    render(<FormularioProducto servicios={servicios()} productoId="otro" alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/no existe/i)
  })

  it('si el servidor rechaza muestra el error y no navega', async () => {
    const alIr = vi.fn()
    render(<FormularioProducto servicios={servicios({ crearProducto: async () => { throw new Error('nombre repetido') } })} alIr={alIr} />)
    await screen.findByRole('heading', { name: 'Nuevo producto' })
    llenar('Águila')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/nombre repetido/)
    expect(alIr).not.toHaveBeenCalled()
  })
})
