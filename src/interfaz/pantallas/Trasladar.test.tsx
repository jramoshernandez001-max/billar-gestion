// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Trasladar".
 *
 * Qué hace: verifica el producto elegido, lo que hay en bodega y nevera, el
 * aviso cuando se pide más de lo disponible, el atajo "Usar N unidades" y el
 * registro del traslado.
 * Cómo lo hace: servicios falsos con un producto de 18 unidades en bodega.
 * Por qué: trasladar mueve stock entre ubicaciones; el diseño impide pedir
 * más de lo que hay en bodega para no dejarla en negativo sin querer.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Trasladar, type ServiciosTrasladar } from './Trasladar'

afterEach(cleanup)

const base = { categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const productos = [
  { id: 'p1', nombre: 'Cerveza Águila', ...base },
  { id: 'p2', nombre: 'Agua Cristal', ...base },
]

function armar(opciones: { productoId?: string; registrarTraslado?: ServiciosTrasladar['inventario']['registrarTraslado'] } = {}) {
  const registrarTraslado = vi.fn(opciones.registrarTraslado ?? (async () => ({ trasladoId: 't', suficiente: true, faltan: 0 })))
  const servicios: ServiciosTrasladar = {
    inventario: {
      listarProductos: async () => productos,
      obtenerStock: async () => new Map([['p1', { bodega: 18, nevera: 4, total: 22 }]]),
      registrarTraslado,
    },
  }
  const alIr = vi.fn()
  render(<Trasladar servicios={servicios} productoId={'productoId' in opciones ? opciones.productoId : 'p1'} alIr={alIr} />)
  return { registrarTraslado, alIr }
}

const escribir = (valor: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Unidades a trasladar' }), { target: { value: valor } })
const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre }) as HTMLButtonElement

describe('Trasladar', () => {
  it('muestra el producto, bodega y nevera, y el máximo disponible', async () => {
    armar()
    expect(await screen.findByRole('heading', { name: 'Trasladar' })).toBeTruthy()
    expect(screen.getByText('De bodega a nevera')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Producto' }) as HTMLSelectElement).value).toBe('p1')
    expect(screen.getByText('Bodega').nextElementSibling?.textContent).toBe('18')
    expect(screen.getByText('Nevera').nextElementSibling?.textContent).toBe('4')
    expect(screen.getByText('Máximo disponible')).toBeTruthy()
    expect(screen.getByText('18 unidades')).toBeTruthy()
    expect(screen.getByText('Ingresa unidades sueltas, no cajas.')).toBeTruthy()
  })

  it('sin cantidad no se puede trasladar', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    expect(boton('Trasladar').disabled).toBe(true)
    expect(screen.queryByText(/Faltaron/)).toBeNull()
  })

  it('pedir más de lo que hay avisa cuánto falta, bloquea y ofrece usar el máximo', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    escribir('24')
    expect(screen.getByText('Faltaron 6 en bodega')).toBeTruthy()
    expect(screen.getByText('Solicitaste 24 unidades, pero solo hay 18 disponibles.')).toBeTruthy()
    expect(screen.getByText('Reduce la cantidad para continuar.')).toBeTruthy()
    expect(boton('Trasladar').disabled).toBe(true)
    fireEvent.click(boton('Usar 18 unidades'))
    expect((screen.getByRole('textbox', { name: 'Unidades a trasladar' }) as HTMLInputElement).value).toBe('18')
    expect(screen.queryByText(/Faltaron/)).toBeNull()
    expect(boton('Trasladar').disabled).toBe(false)
  })

  it('solo acepta números en el campo', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    escribir('1a2')
    expect((screen.getByRole('textbox', { name: 'Unidades a trasladar' }) as HTMLInputElement).value).toBe('12')
  })

  it('registra el traslado y vuelve al inventario', async () => {
    const { registrarTraslado, alIr } = armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    escribir('6')
    fireEvent.click(boton('Trasladar'))
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('inventario'))
    expect(registrarTraslado).toHaveBeenCalledWith('p1', 6)
  })

  it('si la base falla, muestra el motivo y se queda', async () => {
    const { alIr } = armar({ registrarTraslado: async () => { throw new Error('Sin conexión') } })
    await screen.findByRole('heading', { name: 'Trasladar' })
    escribir('6')
    fireEvent.click(boton('Trasladar'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Sin conexión/)
    expect(alIr).not.toHaveBeenCalled()
  })

  it('cambiar de producto va a la ruta del otro producto', async () => {
    const { alIr } = armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Producto' }), { target: { value: 'p2' } })
    expect(alIr).toHaveBeenCalledWith('inventario/trasladar/p2')
  })

  it('sin producto elegido pide elegir uno y no deja trasladar', async () => {
    armar({ productoId: undefined })
    await screen.findByRole('heading', { name: 'Trasladar' })
    expect(screen.getByRole('option', { name: 'Elegir producto' })).toBeTruthy()
    expect(boton('Trasladar').disabled).toBe(true)
  })

  it('la flecha vuelve al inventario', async () => {
    const { alIr } = armar()
    await screen.findByRole('heading', { name: 'Trasladar' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alIr).toHaveBeenCalledWith('inventario')
  })
})
