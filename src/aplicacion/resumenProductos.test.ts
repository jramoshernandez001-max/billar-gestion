/**
 * Pruebas de la lista de productos.
 *
 * Qué hace: verifica la descripción de cada producto y la búsqueda por nombre
 * sin importar mayúsculas ni tildes.
 * Cómo lo hace: productos inventados.
 * Por qué: la pantalla no calcula; solo dibuja estas filas.
 */
import { describe, it, expect } from 'vitest'
import { resumirProductos } from './resumenProductos'

const productos = [
  { id: 'b', nombre: 'Águila', categoria: 'cerveza' as const, unidadesPorCaja: 30, manejaSixpack: true, precioUnidad: 3000, precioCaja: 80000 },
  { id: 'a', nombre: 'Agua Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 },
]

describe('resumirProductos', () => {
  it('ordena por nombre y describe presentación y precios', () => {
    expect(resumirProductos(productos, '')).toEqual([
      { id: 'a', nombre: 'Agua Ejemplo', categoria: 'cerveza', detalle: '12 unidades por caja · Sin sixpack', precioUnidad: 1500, precioCaja: 15000 },
      { id: 'b', nombre: 'Águila', categoria: 'cerveza', detalle: '30 unidades por caja · Con sixpack', precioUnidad: 3000, precioCaja: 80000 },
    ])
  })

  it('busca sin importar mayúsculas ni tildes', () => {
    expect(resumirProductos(productos, 'aguila').map((p) => p.id)).toEqual(['b'])
    expect(resumirProductos(productos, ' AGUA ').map((p) => p.id)).toEqual(['a'])
  })

  it('una búsqueda sin resultados devuelve lista vacía', () => {
    expect(resumirProductos(productos, 'xyz')).toEqual([])
  })

  describe('categorías', () => {
    const conLicor = [
      ...productos,
      { id: 'l', nombre: 'Aguardiente Ejemplo', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false, precioUnidad: 50000, precioCaja: 50000 },
    ]

    it('el licor se describe como botella entera', () => {
      const licor = resumirProductos(conLicor, '').find((p) => p.id === 'l')
      expect(licor).toMatchObject({ categoria: 'licor', detalle: 'Botella entera' })
    })

    it('filtra por categoría y combina con la búsqueda', () => {
      expect(resumirProductos(conLicor, '', 'licor').map((p) => p.id)).toEqual(['l'])
      expect(resumirProductos(conLicor, '', 'cerveza').map((p) => p.id)).toEqual(['a', 'b'])
      expect(resumirProductos(conLicor, 'agua', 'licor').map((p) => p.id)).toEqual(['l'])
      expect(resumirProductos(conLicor, 'agua', 'otro')).toEqual([])
    })
  })
})
