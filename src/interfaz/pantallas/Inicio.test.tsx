// @vitest-environment jsdom
/**
 * Pruebas de la pantalla de inicio.
 *
 * Qué hace: verifica que muestre el saludo, las ventas de hoy, los avisos
 * "Por revisar" y el gráfico de 7 días con los datos reales, y los estados de
 * carga y error.
 * Cómo lo hace: servicios falsos con datos inventados y textos del diseño.
 * Por qué: es la primera pantalla; un aviso o un total equivocado engaña al
 * dueño desde el primer vistazo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Inicio } from './Inicio'
import type { ServiciosInicio } from '../../aplicacion/cargarInicio'

afterEach(cleanup)

const producto = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }

function servicios(sobre: Partial<ServiciosInicio> = {}): ServiciosInicio {
  return {
    ventas: {
      listarVentas: async () => [
        { id: 'v', fecha: '2026-11-03', estado: 'vigente', renglones: [{ productoId: 'p1', producto, presentacion: 'unidad', cantidad: 50, precioCobrado: 3000 }] },
      ],
    },
    deudas: {
      listarDeudas: async () => [
        { id: 'd1', cliente: 'Ana', fecha: '2026-11-01', monto: 50000, descripcion: 'Fiado', estado: 'vigente' },
        { id: 'd2', cliente: 'Beto', fecha: '2026-11-02', monto: 15000, descripcion: 'Fiado', estado: 'vigente' },
      ],
      listarAbonos: async () => [],
    },
    inventario: {
      listarProductos: async () => [{ id: 'p1', nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }],
      obtenerStock: async () => new Map([['p1', { bodega: 10, nevera: -2, total: 8 }]]),
    },
    cierres: {
      listarCierres: async () => [
        { id: 'c1', tipo: 'diario', desde: '2026-11-02', hasta: '2026-11-02', calculadoEn: '2026-11-02T23:00:00.000Z', efectivo: 0, transferencias: 0, dineroCorregidoEn: null, costosManuales: {}, costosUsados: [], resultado: {} },
      ],
    },
    desactualizados: { idsDesactualizados: async () => ['c1'] },
    ...sobre,
  }
}

const dibujar = (s: ServiciosInicio, alIr = vi.fn()) =>
  render(<Inicio servicios={s} nombre="Andrea" hoy="2026-11-03" alIr={alIr} />)

describe('Inicio', () => {
  it('mientras carga muestra un aviso de estado', () => {
    dibujar(servicios())
    expect(screen.getByRole('status').textContent).toMatch(/cargando/i)
  })

  it('saluda con el nombre y la fecha de hoy', async () => {
    dibujar(servicios())
    expect(await screen.findByText('Hola, Andrea')).toBeTruthy()
    expect(screen.getByText(/Martes, 3 de noviembre/)).toBeTruthy()
  })

  it('sin nombre solo dice Hola', async () => {
    render(<Inicio servicios={servicios()} hoy="2026-11-03" alIr={vi.fn()} />)
    expect(await screen.findByText('Hola')).toBeTruthy()
  })

  it('muestra las ventas de hoy: total, cantidad y unidades', async () => {
    dibujar(servicios())
    expect(await screen.findByText('$ 150.000', { selector: 'p.cifra' })).toBeTruthy()
    expect(screen.getByText('1 venta')).toBeTruthy()
    expect(screen.getByText('50 unidades')).toBeTruthy()
  })

  it('muestra los tres avisos con sus datos', async () => {
    dibujar(servicios())
    expect(await screen.findByText('Stock negativo')).toBeTruthy()
    expect(screen.getByText('1 producto con faltantes por registrar')).toBeTruthy()
    expect(screen.getByText('Cierre desactualizado')).toBeTruthy()
    expect(screen.getByText('02/11 · Cambiaron los movimientos')).toBeTruthy()
    expect(screen.getByText('Deudas pendientes')).toBeTruthy()
    expect(screen.getByText('$ 65.000 en 2 cuentas')).toBeTruthy()
  })

  it('sin nada por revisar lo dice', async () => {
    dibujar(servicios({
      deudas: { listarDeudas: async () => [], listarAbonos: async () => [] },
      inventario: { listarProductos: async () => [], obtenerStock: async () => new Map() },
      desactualizados: { idsDesactualizados: async () => [] },
    }))
    expect(await screen.findByText('Todo en orden')).toBeTruthy()
  })

  it('dibuja las siete barras del gráfico, con hoy resaltado', async () => {
    dibujar(servicios())
    await screen.findByText('Hola, Andrea')
    const grafico = screen.getByRole('img', { name: /ventas de los últimos 7 días/i })
    expect(within(grafico).getAllByText(/^(Lu|Ma|Mi|Ju|Vi|Sá|Do)$/)).toHaveLength(7)
    expect(grafico.querySelectorAll('.grafico__barra--hoy')).toHaveLength(1)
    expect(screen.getByText('28 oct – 3 nov')).toBeTruthy()
    expect(screen.getByText('Hoy: $ 150.000 · Solo ventas vigentes')).toBeTruthy()
  })

  it('los atajos y los avisos llevan a su pantalla', async () => {
    const alIr = vi.fn()
    dibujar(servicios(), alIr)
    await screen.findByText('Hola, Andrea')
    fireEvent.click(screen.getByRole('button', { name: 'Vender' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar día' }))
    fireEvent.click(screen.getByRole('button', { name: /Deudas pendientes/ }))
    expect(alIr.mock.calls.map((c) => c[0])).toEqual(['vender', 'inventario/comprar', 'inventario/trasladar', 'cierres/diario', 'deudas'])
  })

  it('si falla la carga muestra el mensaje y permite reintentar', async () => {
    dibujar(servicios({ ventas: { listarVentas: async () => { throw new Error('sin permisos') } } }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin permisos/)
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy()
  })
})
