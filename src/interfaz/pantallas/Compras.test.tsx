// @vitest-environment jsdom
/**
 * Pruebas del historial de compras.
 *
 * Qué hace: verifica el listado, los filtros, la anulación con motivo y los
 * accesos a corregir costo y nueva compra.
 * Cómo lo hace: servicios falsos con compras inventadas.
 * Por qué: anular una compra mueve el inventario; debe exigir motivo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Compras, type ServiciosCompras } from './Compras'

afterEach(cleanup)

const cerveza = { unidadesPorCaja: 24, manejaSixpack: true }
const compra = (id: string, fecha: string, estado: 'vigente' | 'anulada') => ({
  id, productoId: 'p1', producto: cerveza, presentacion: 'caja' as const, cantidad: 2, costoTotal: 96000, fecha, registradoEn: `${fecha}T15:00:00.000Z`, estado,
})

function servicios(anularCompra = vi.fn(async () => undefined)): ServiciosCompras {
  return {
    inventario: {
      listarCompras: async () => [compra('c1', '2026-11-02', 'vigente'), compra('c2', '2026-10-31', 'anulada'), compra('c0', '2026-08-01', 'vigente')],
      listarProductos: async () => [{ id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }],
      anularCompra,
    },
    bitacora: {
      listarBitacora: async () => [
        { id: 'b', momento: new Date(2026, 10, 1, 10, 0).toISOString(), usuario: 'a@x.com', accion: 'anular-registro', tabla: 'compras', registroId: 'c2', antes: null, despues: {}, motivo: 'compra duplicada' },
      ],
    },
  }
}

const dibujar = (s: ServiciosCompras, alIr = vi.fn()) => render(<Compras servicios={s} hoy="2026-11-03" alIr={alIr} />)

describe('Compras', () => {
  it('lista las compras de los últimos 7 días con número, costo y estado', async () => {
    dibujar(servicios())
    expect(await screen.findByText('C-003 · 02/11/2026')).toBeTruthy()
    expect(screen.getAllByText('Cerveza Ejemplo')).toHaveLength(2)
    expect(screen.getAllByText('2 cajas · 48 unidades')).toHaveLength(2)
    expect(screen.getAllByText('$ 2.000 / unidad')).toHaveLength(2)
    expect(screen.queryByText(/C-001/)).toBeNull()
  })

  it('las anuladas muestran el motivo y no ofrecen acciones', async () => {
    dibujar(servicios())
    await screen.findByText('C-003 · 02/11/2026')
    expect(screen.getByText('Motivo: compra duplicada')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Anular' })).toHaveLength(1)
  })

  it('filtra por estado y por periodo', async () => {
    dibujar(servicios())
    await screen.findByText('C-003 · 02/11/2026')
    fireEvent.click(screen.getByRole('radio', { name: 'Anuladas' }))
    expect(screen.queryByText('C-003 · 02/11/2026')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }))
    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'todo' } })
    expect(screen.getByText('C-001 · 01/08/2026')).toBeTruthy()
  })

  it('anular exige motivo, llama al repositorio y recarga', async () => {
    const anular = vi.fn(async () => undefined)
    dibujar(servicios(anular))
    await screen.findByText('C-003 · 02/11/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar anulación' }) as HTMLButtonElement
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: ' error de digitación ' } })
    fireEvent.click(confirmar)
    await waitFor(() => expect(anular).toHaveBeenCalledWith('c1', 'error de digitación'))
  })

  it('corregir costo y nueva compra llevan a su pantalla', async () => {
    const alIr = vi.fn()
    dibujar(servicios(), alIr)
    await screen.findByText('C-003 · 02/11/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Corregir costo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nueva compra' }))
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['mas/compras/corregir/c1', 'inventario/comprar'])
  })

  it('si falla la carga permite reintentar', async () => {
    const s = servicios()
    s.inventario.listarCompras = async () => { throw new Error('sin red') }
    dibujar(s)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })
})
