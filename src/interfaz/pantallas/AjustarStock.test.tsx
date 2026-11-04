// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Ajustar stock".
 *
 * Qué hace: verifica la ubicación y el tipo de ajuste, el stock actual y el
 * stock después del ajuste, el motivo obligatorio y el registro con el signo
 * correcto.
 * Cómo lo hace: servicios falsos con un producto en −2 en nevera.
 * Por qué: el ajuste corrige el inventario con un conteo físico; debe dejar
 * motivo y mandar las unidades con el signo que corresponde.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AjustarStock, type ServiciosAjustar } from './AjustarStock'

afterEach(cleanup)

const base = { categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }

function armar(opciones: { registrarAjuste?: ServiciosAjustar['inventario']['registrarAjuste'] } = {}) {
  const registrarAjuste = vi.fn(opciones.registrarAjuste ?? (async () => 'm'))
  const servicios: ServiciosAjustar = {
    inventario: {
      listarProductos: async () => [{ id: 'p1', nombre: 'Cerveza Poker', ...base }, { id: 'p2', nombre: 'Agua', ...base }],
      obtenerStock: async () => new Map([['p1', { bodega: 10, nevera: -2, total: 8 }]]),
      registrarAjuste,
    },
  }
  const alIr = vi.fn()
  render(<AjustarStock servicios={servicios} productoId="p1" alIr={alIr} />)
  return { registrarAjuste, alIr }
}

const unidades = (v: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Unidades' }), { target: { value: v } })
const motivo = (v: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Motivo obligatorio' }), { target: { value: v } })
const guardar = () => screen.getByRole('button', { name: 'Guardar ajuste' }) as HTMLButtonElement

describe('AjustarStock', () => {
  it('muestra producto, ubicación nevera por defecto y el stock actual en rojo si es negativo', async () => {
    armar()
    expect(await screen.findByRole('heading', { name: 'Ajustar stock' })).toBeTruthy()
    expect(screen.getByText('Corrección manual de existencias')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Nevera' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Stock actual · Nevera')).toBeTruthy()
    expect(screen.getByText('−2 unidades', { selector: '.dato__valor--negativo' })).toBeTruthy()
    expect(screen.getByText('Cuenta las unidades físicas antes de ajustar.')).toBeTruthy()
    expect(screen.getByText('El motivo quedará en el registro de movimientos.')).toBeTruthy()
  })

  it('cambiar la ubicación cambia el stock actual', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    fireEvent.click(screen.getByRole('radio', { name: 'Bodega' }))
    expect(screen.getByText('Stock actual · Bodega')).toBeTruthy()
    expect(screen.getByText('10 unidades', { selector: '.dato__valor' })).toBeTruthy()
  })

  it('calcula el stock después de sumar o restar', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    unidades('6')
    expect(screen.getByText('4 unidades', { selector: '.dato__total' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Restar (−)' }))
    expect(screen.getByText('−8 unidades', { selector: '.dato__total' })).toBeTruthy()
  })

  it('no deja guardar sin unidades o sin motivo y dice qué falta', async () => {
    armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    expect(guardar().disabled).toBe(true)
    unidades('6')
    expect(guardar().disabled).toBe(true)
    expect(screen.getByText('Escribe el motivo del ajuste')).toBeTruthy()
    motivo('Conteo físico: había 4 unidades sin registrar.')
    expect(guardar().disabled).toBe(false)
  })

  it('guarda sumando con signo positivo y vuelve al inventario', async () => {
    const { registrarAjuste, alIr } = armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    unidades('6')
    motivo('Conteo físico')
    fireEvent.click(guardar())
    await waitFor(() => expect(alIr).toHaveBeenCalledWith('inventario'))
    expect(registrarAjuste).toHaveBeenCalledWith({ productoId: 'p1', ubicacion: 'nevera', unidades: 6, motivo: 'Conteo físico' })
  })

  it('guarda restando con signo negativo y en la ubicación elegida', async () => {
    const { registrarAjuste } = armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    fireEvent.click(screen.getByRole('radio', { name: 'Bodega' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Restar (−)' }))
    unidades('3')
    motivo('Se dañaron')
    fireEvent.click(guardar())
    await waitFor(() => expect(registrarAjuste).toHaveBeenCalled())
    expect(registrarAjuste).toHaveBeenCalledWith({ productoId: 'p1', ubicacion: 'bodega', unidades: -3, motivo: 'Se dañaron' })
  })

  it('si la base falla, muestra el motivo y se queda', async () => {
    const { alIr } = armar({ registrarAjuste: async () => { throw new Error('Sin conexión') } })
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    unidades('6')
    motivo('x')
    fireEvent.click(guardar())
    expect((await screen.findByRole('alert')).textContent).toMatch(/Sin conexión/)
    expect(alIr).not.toHaveBeenCalled()
  })

  it('cambiar de producto va a la ruta del otro y la flecha vuelve al inventario', async () => {
    const { alIr } = armar()
    await screen.findByRole('heading', { name: 'Ajustar stock' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Producto' }), { target: { value: 'p2' } })
    expect(alIr).toHaveBeenCalledWith('inventario/ajustar/p2')
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alIr).toHaveBeenCalledWith('inventario')
  })
})
