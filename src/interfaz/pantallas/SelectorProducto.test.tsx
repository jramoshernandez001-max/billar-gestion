// @vitest-environment jsdom
/**
 * Pruebas de la pantalla "Elegir producto".
 *
 * Qué hace: verifica la búsqueda (sin importar mayúsculas ni tildes), el
 * conteo de resultados, la marca del producto elegido, el stock en nevera y
 * que al tocar un producto se avise y se pueda volver.
 * Cómo lo hace: productos inventados y funciones espía.
 * Por qué: es el paso donde se decide qué se descuenta de la nevera; un
 * producto equivocado descuadra el inventario.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SelectorProducto, type OpcionProducto } from './SelectorProducto'

afterEach(cleanup)

const opciones: OpcionProducto[] = [
  { id: 'p1', nombre: 'Cerveza Águila', unidadesPorCaja: 24, precioUnidad: 3000, enNevera: 4 },
  { id: 'p2', nombre: 'Cerveza Poker', unidadesPorCaja: 24, precioUnidad: 3000, enNevera: -2 },
  { id: 'p3', nombre: 'Agua Cristal', unidadesPorCaja: 12, precioUnidad: 2000, enNevera: 0 },
]

function mostrar(sobre: Partial<Parameters<typeof SelectorProducto>[0]> = {}) {
  const alElegir = vi.fn()
  const alVolver = vi.fn()
  render(<SelectorProducto opciones={opciones} seleccionado="p1" alElegir={alElegir} alVolver={alVolver} {...sobre} />)
  return { alElegir, alVolver }
}

describe('SelectorProducto', () => {
  it('muestra todos los productos con precio por unidad, unidades por caja y stock en nevera', () => {
    mostrar()
    expect(screen.getByRole('heading', { name: 'Elegir producto' })).toBeTruthy()
    expect(screen.getByText('3 resultados · Precios por unidad')).toBeTruthy()
    expect(screen.getByText('4 en nevera')).toBeTruthy()
    expect(screen.getByText('−2 en nevera')).toBeTruthy()
    expect(screen.getByText('0 en nevera')).toBeTruthy()
    expect(screen.getAllByText('24 unid/caja')).toHaveLength(2)
    expect(screen.getAllByText('$ 3.000')).toHaveLength(2)
  })

  it('busca sin importar mayúsculas ni tildes', () => {
    mostrar()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), { target: { value: 'aguila' } })
    expect(screen.getByText('1 resultado · Precios por unidad')).toBeTruthy()
    expect(screen.getByText('Cerveza Águila')).toBeTruthy()
    expect(screen.queryByText('Cerveza Poker')).toBeNull()
  })

  it('sin coincidencias lo dice', () => {
    mostrar()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), { target: { value: 'zzz' } })
    expect(screen.getByText('0 resultados · Precios por unidad')).toBeTruthy()
    expect(screen.getByText('No hay productos con ese nombre.')).toBeTruthy()
  })

  it('marca el producto elegido', () => {
    mostrar()
    expect(screen.getByRole('radio', { name: /Cerveza Águila/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /Cerveza Poker/ }).getAttribute('aria-checked')).toBe('false')
  })

  it('al tocar un producto avisa cuál es', () => {
    const { alElegir } = mostrar()
    fireEvent.click(screen.getByRole('radio', { name: /Agua Cristal/ }))
    expect(alElegir).toHaveBeenCalledWith('p3')
  })

  it('la flecha vuelve a la venta', () => {
    const { alVolver } = mostrar()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(alVolver).toHaveBeenCalled()
  })
})
