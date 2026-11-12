// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Ventas".
 *
 * Qué hace: verifica el listado del día, el resumen de vigentes, los filtros,
 * el cambio de fecha, "cargar más" y la anulación con motivo.
 * Cómo lo hace: servicios falsos con ventas inventadas y funciones espía.
 * Por qué: anular una venta cambia el dinero y el inventario; debe exigir un
 * motivo y refrescar lo que se ve.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Ventas, type ServiciosVentas } from './Ventas'
import type { VentaRegistrada } from '../../datos/ventas'
import type { EntradaBitacora } from '../../datos/bitacora'

afterEach(cleanup)

const producto = { categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const hora = (h: number, m: number) => new Date(2026, 10, 3, h, m).toISOString()
const venta = (id: string, creadoEn: string, estado: 'vigente' | 'anulada', cantidad: number): VentaRegistrada => ({
  id, fecha: '2026-11-03', estado, creadoEn,
  renglones: [{ productoId: 'p1', producto, presentacion: 'unidad', cantidad, precioCobrado: 3000 }],
})

const bitacora: EntradaBitacora[] = [{
  id: 'b1', momento: hora(17, 0), usuario: 'ana@ejemplo.com', accion: 'anular-registro', tabla: 'ventas',
  registroId: 'v2', antes: null, despues: {}, motivo: 'registro duplicado',
}]

function armar(ventas: VentaRegistrada[], sobre: Partial<ServiciosVentas['ventas']> = {}, fechaInicial?: string) {
  const anularVenta = vi.fn(sobre.anularVenta ?? (async () => undefined))
  const listarVentas = vi.fn(async () => ventas)
  const servicios: ServiciosVentas = {
    ventas: { listarVentas, anularVenta },
    inventario: { listarProductos: async () => [{ id: 'p1', nombre: 'Águila', ...producto }] },
    bitacora: { listarBitacora: async () => bitacora },
  }
  const alIr = vi.fn()
  render(<Ventas servicios={servicios} hoy="2026-11-04" fechaInicial={fechaInicial ?? '2026-11-03'} alIr={alIr} />)
  return { anularVenta, listarVentas, alIr }
}

const tres = [
  venta('v1', hora(14, 30), 'vigente', 5),
  venta('v2', hora(13, 10), 'anulada', 2),
  venta('v3', hora(15, 5), 'vigente', 10),
]

describe('Ventas', () => {
  it('muestra el resumen de vigentes y las tarjetas del día, la más reciente primero', async () => {
    armar(tres)
    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeTruthy()
    expect(screen.getByText('Movimientos del negocio')).toBeTruthy()
    expect(screen.getByText('2 vigentes · 15 unidades')).toBeTruthy()
    expect(screen.getByText('$ 45.000', { selector: '.dato__total' })).toBeTruthy()
    const tarjetas = screen.getAllByRole('article')
    expect(tarjetas).toHaveLength(3)
    expect(within(tarjetas[0]).getByText('V-3 · 15:05')).toBeTruthy()
    expect(within(tarjetas[0]).getByText('Águila · Unidad × 10')).toBeTruthy()
    expect(within(tarjetas[0]).getByText('$ 3.000 c/u · $ 30.000')).toBeTruthy()
    expect(within(tarjetas[0]).getByText('Vigente')).toBeTruthy()
  })

  it('la anulada muestra su motivo y fecha y no ofrece anular', async () => {
    armar(tres)
    const anulada = (await screen.findAllByRole('article'))[2]
    expect(within(anulada).getByText('Anulada')).toBeTruthy()
    expect(within(anulada).getByText('Motivo: registro duplicado · 03/11/2026')).toBeTruthy()
    expect(within(anulada).queryByRole('button', { name: /Anular/ })).toBeNull()
  })

  it('filtra por vigentes y anuladas', async () => {
    armar(tres)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Anuladas' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    fireEvent.click(screen.getByRole('radio', { name: 'Vigentes' }))
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('sin ventas en el día lo dice', async () => {
    armar([])
    expect(await screen.findByText('No hay ventas en este día.')).toBeTruthy()
  })

  it('cambiar la fecha muestra las ventas de ese día', async () => {
    armar(tres)
    await screen.findAllByRole('article')
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-02' } })
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('con más de la página, "Cargar más" muestra el resto', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) => venta(`x${i}`, hora(8, i), 'vigente', 1))
    armar(muchas)
    await screen.findAllByRole('article')
    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByText('10 de 12 movimientos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(screen.getAllByRole('article')).toHaveLength(12)
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
  })

  it('anular pide el motivo, no deja confirmar vacío y recarga al terminar', async () => {
    const { anularVenta, listarVentas } = armar(tres)
    const primera = (await screen.findAllByRole('article'))[0]
    fireEvent.click(within(primera).getByRole('button', { name: 'Anular' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar anulación' }) as HTMLButtonElement
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo de la anulación' }), { target: { value: '  error de digitación ' } })
    expect(confirmar.disabled).toBe(false)
    fireEvent.click(confirmar)
    await waitFor(() => expect(anularVenta).toHaveBeenCalledWith('v3', 'error de digitación'))
    await waitFor(() => expect(listarVentas).toHaveBeenCalledTimes(2))
  })

  it('cancelar la anulación cierra el formulario sin llamar a la base', async () => {
    const { anularVenta } = armar(tres)
    const primera = (await screen.findAllByRole('article'))[0]
    fireEvent.click(within(primera).getByRole('button', { name: 'Anular' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('textbox', { name: 'Motivo de la anulación' })).toBeNull()
    expect(anularVenta).not.toHaveBeenCalled()
  })

  it('si la base rechaza la anulación, muestra el motivo del error', async () => {
    armar(tres, { anularVenta: async () => { throw new Error('La venta ya está anulada') } })
    const primera = (await screen.findAllByRole('article'))[0]
    fireEvent.click(within(primera).getByRole('button', { name: 'Anular' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo de la anulación' }), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya está anulada/)
  })

  it('la flecha vuelve a "Más"', async () => {
    const { alIr } = armar(tres)
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alIr).toHaveBeenCalledWith('mas')
  })

  it('cada venta vigente ofrece editar y lleva a la venta ya llena; la anulada no', async () => {
    const { alIr } = armar(tres)
    const tarjetas = await screen.findAllByRole('article')
    fireEvent.click(within(tarjetas[0]).getByRole('button', { name: 'Editar' }))
    expect(alIr).toHaveBeenCalledWith('mas/ventas/editar/v3')
    const anulada = tarjetas.find((t) => within(t).queryByText('Anulada') !== null)
    expect(anulada).toBeTruthy()
    expect(within(anulada as HTMLElement).queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  it('abre en la fecha inicial que recibe (otro día sin ventas)', async () => {
    armar(tres, {}, '2026-11-04')
    expect(await screen.findByText('No hay ventas en este día.')).toBeTruthy()
  })
})
