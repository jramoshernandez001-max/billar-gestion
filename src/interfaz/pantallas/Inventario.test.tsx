// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Inventario".
 *
 * Qué hace: verifica la lista de productos con bodega, nevera y total, el
 * aviso de existencias negativas, la búsqueda y las acciones de cada
 * producto (trasladar, ajustar, comprar, editar).
 * Cómo lo hace: servicios falsos con productos inventados y una función espía
 * para la navegación.
 * Por qué: es donde se ve si el stock cuadra; un negativo debe notarse y cada
 * acción debe abrir la pantalla del producto correcto.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Inventario, type ServiciosInventario } from './Inventario'

afterEach(cleanup)

const base = { categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const productos = [
  { id: 'p1', nombre: 'Cerveza Águila', ...base },
  { id: 'p2', nombre: 'Cerveza Poker', ...base },
  { id: 'p3', nombre: 'Agua Cristal', ...base, unidadesPorCaja: 12, manejaSixpack: false },
]
const stock = new Map([
  ['p1', { bodega: 18, nevera: 4, total: 22 }],
  ['p2', { bodega: 0, nevera: -2, total: -2 }],
  ['p3', { bodega: 24, nevera: 12, total: 36 }],
])

function armar(sobre: Partial<ServiciosInventario['inventario']> = {}) {
  const servicios: ServiciosInventario = {
    inventario: { listarProductos: async () => productos, obtenerStock: async () => stock, ...sobre },
  }
  const alIr = vi.fn()
  render(<Inventario servicios={servicios} alIr={alIr} />)
  return { alIr }
}

const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })

describe('Inventario', () => {
  it('muestra arriba el total de cajas en bodega, en nevera y en general, con las sueltas', async () => {
    armar()
    const totales = within(await screen.findByRole('region', { name: 'Total de cajas' }))
    // Agua 24/12/36 (x12) → 2, 1 y 3 cajas; Águila 18/4/22 (x24) → solo sueltas; Poker -2 en nevera.
    expect(totales.getByText('Bodega').nextElementSibling?.textContent).toBe('2')
    expect(totales.getByText('Nevera').nextElementSibling?.textContent).toBe('1')
    expect(totales.getByText('General').nextElementSibling?.textContent).toBe('3')
    expect(totales.getByText('+ 18 sueltas')).toBeTruthy()
    expect(totales.getByText('+ 2 sueltas')).toBeTruthy()
    expect(totales.getByText('+ 20 sueltas')).toBeTruthy()
  })

  it('los totales de cajas siguen la búsqueda', async () => {
    armar()
    await screen.findAllByRole('article')
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'agua' } })
    const totales = within(screen.getByRole('region', { name: 'Total de cajas' }))
    expect(totales.getByText('General').nextElementSibling?.textContent).toBe('3')
    expect(totales.queryByText(/sueltas/)).toBeNull()
  })

  it('muestra el título, la cuenta de productos y una tarjeta por producto ordenada por nombre', async () => {
    armar()
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeTruthy()
    expect(screen.getByText('3 productos · Stock en unidades')).toBeTruthy()
    expect(screen.getAllByRole('article').map((t) => t.getAttribute('aria-label'))).toEqual([
      'Agua Cristal', 'Cerveza Águila', 'Cerveza Poker',
    ])
  })

  it('cada tarjeta muestra bodega, nevera y total, y su equivalente en presentaciones', async () => {
    armar()
    await screen.findAllByRole('article')
    const aguila = within(tarjeta('Cerveza Águila'))
    expect(aguila.getByText('Bodega').nextElementSibling?.textContent).toBe('18')
    expect(aguila.getByText('Nevera').nextElementSibling?.textContent).toBe('4')
    expect(aguila.getByText('Total').nextElementSibling?.textContent).toBe('22')
    expect(aguila.getByText('3 sixpacks · 4 sueltas')).toBeTruthy()
  })

  it('un producto con stock negativo lleva la etiqueta "Negativo" y el aviso lo cuenta', async () => {
    armar()
    await screen.findAllByRole('article')
    expect(within(tarjeta('Cerveza Poker')).getByText('Negativo')).toBeTruthy()
    // Nevera y total quedan en -2, en rojo.
    expect(within(tarjeta('Cerveza Poker')).getAllByText('-2', { selector: '.existencia__valor--negativo' })).toHaveLength(2)
    expect(screen.getByText('1 producto necesita atención')).toBeTruthy()
    expect(screen.getByText('Revisa las existencias negativas.')).toBeTruthy()
    expect(within(tarjeta('Agua Cristal')).queryByText('Negativo')).toBeNull()
  })

  it('sin negativos no muestra el aviso', async () => {
    armar({ obtenerStock: async () => new Map([['p1', { bodega: 1, nevera: 1, total: 2 }]]) })
    await screen.findAllByRole('article')
    expect(screen.queryByText(/necesita/)).toBeNull()
  })

  it('un producto sin movimientos aparece en cero', async () => {
    armar({ obtenerStock: async () => new Map() })
    await screen.findAllByRole('article')
    expect(within(tarjeta('Agua Cristal')).getByText('Sin existencias')).toBeTruthy()
  })

  it('busca por nombre sin importar mayúsculas ni tildes', async () => {
    armar()
    await screen.findAllByRole('article')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'aguila' } })
    expect(screen.getAllByRole('article')).toHaveLength(1)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'zzz' } })
    expect(screen.getByText('No hay productos con ese nombre o categoría.')).toBeTruthy()
  })

  it('las acciones abren la pantalla del producto elegido', async () => {
    const { alIr } = armar()
    await screen.findAllByRole('article')
    const poker = within(tarjeta('Cerveza Poker'))
    fireEvent.click(poker.getByRole('button', { name: 'Trasladar' }))
    fireEvent.click(poker.getByRole('button', { name: 'Ajustar' }))
    fireEvent.click(poker.getByRole('button', { name: 'Comprar' }))
    fireEvent.click(poker.getByRole('button', { name: 'Editar' }))
    expect(alIr.mock.calls.map((c) => c[0])).toEqual([
      'inventario/trasladar/p2', 'inventario/ajustar/p2', 'inventario/comprar/p2', 'inventario/editar/p2',
    ])
  })

  it('dice cuándo se actualizó', async () => {
    armar()
    await screen.findAllByRole('article')
    expect(screen.getByText(/Actualizado hoy a las \d\d:\d\d/)).toBeTruthy()
  })

  it('si falla la carga lo dice y deja reintentar', async () => {
    armar({ listarProductos: async () => { throw new Error('sin red') } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/sin red/)
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('filtra por categoría y el licor no muestra equivalente en cajas', async () => {
    const licor = { id: 'p4', nombre: 'Aguardiente Ejemplo', ...base, categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false }
    armar({
      listarProductos: async () => [...productos, licor],
      obtenerStock: async () => new Map([...stock, ['p4', { bodega: 6, nevera: 3, total: 9 }]]),
    })
    await screen.findAllByRole('article')
    expect(screen.getAllByRole('article')).toHaveLength(4)
    fireEvent.click(screen.getByRole('radio', { name: 'Licor' }))
    expect(screen.getAllByRole('article').map((t) => t.getAttribute('aria-label'))).toEqual(['Aguardiente Ejemplo'])
    expect(within(tarjeta('Aguardiente Ejemplo')).queryByText(/caja/i)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Otros' }))
    expect(screen.getByText('No hay productos con ese nombre o categoría.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)
  })
})
