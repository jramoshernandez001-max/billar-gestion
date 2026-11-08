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

const productos = [{ id: 'p1', nombre: 'Cerveza Águila', categoria: 'cerveza' as const, unidadesPorCaja: 30, manejaSixpack: false, precioUnidad: 3500, precioCaja: 105000 }]
const servicios = (entradas: EntradaBitacora[]): ServiciosBitacora => ({
  bitacora: { listarBitacora: async () => entradas },
  inventario: { listarProductos: async () => productos },
})

describe('Bitacora', () => {
  it('cada tarjeta dice dónde fue el cambio y cómo estaba antes y cómo quedó', async () => {
    const corregida = entrada('a', 1, {
      accion: 'corregir-costo-compra',
      tabla: 'compras',
      antes: { producto_id: 'p1', numero: 3, costo_total: 96000 },
      despues: { producto_id: 'p1', numero: 3, costo_total: 100000 },
      motivo: 'factura',
    })
    render(<Bitacora servicios={servicios([corregida])} alIr={vi.fn()} />)
    expect(await screen.findByText('Compras · Cerveza Águila · C-003')).toBeTruthy()
    expect(screen.getByText('Costo total: $ 96.000 → $ 100.000')).toBeTruthy()
  })

  it('muestra solo los primeros tres cambios y avisa cuántos más hay', async () => {
    const nueva = entrada('a', 1, { accion: 'registrar-deuda', tabla: 'deudas', despues: { cliente: 'Pedro', fecha: '2026-11-01', monto: 5000, descripcion: 'cervezas', estado: 'vigente' } })
    render(<Bitacora servicios={servicios([nueva])} alIr={vi.fn()} />)
    expect(await screen.findByText('Deudas · Pedro')).toBeTruthy()
    expect(screen.getByText('Cliente: — → Pedro')).toBeTruthy()
    expect(screen.getByText('y 2 cambios más')).toBeTruthy()
  })

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
    render(<Bitacora servicios={{ ...servicios([]), bitacora: { listarBitacora: async () => { throw new Error('sin red') } } }} alIr={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
  })
})
