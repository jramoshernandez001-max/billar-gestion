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
  { id: 'b', nombre: 'Águila', unidadesPorCaja: 30, manejaSixpack: true, precioUnidad: 3000, precioCaja: 80000 },
  { id: 'a', nombre: 'Agua Ejemplo', unidadesPorCaja: 12, manejaSixpack: false, precioUnidad: 1500, precioCaja: 15000 },
]

describe('resumirProductos', () => {
  it('ordena por nombre y describe presentación y precios', () => {
    expect(resumirProductos(productos, '')).toEqual([
      { id: 'a', nombre: 'Agua Ejemplo', detalle: '12 unidades por caja · Sin sixpack', precioUnidad: 1500, precioCaja: 15000 },
      { id: 'b', nombre: 'Águila', detalle: '30 unidades por caja · Con sixpack', precioUnidad: 3000, precioCaja: 80000 },
    ])
  })

  it('busca sin importar mayúsculas ni tildes', () => {
    expect(resumirProductos(productos, 'aguila').map((p) => p.id)).toEqual(['b'])
    expect(resumirProductos(productos, ' AGUA ').map((p) => p.id)).toEqual(['a'])
  })

  it('una búsqueda sin resultados devuelve lista vacía', () => {
    expect(resumirProductos(productos, 'xyz')).toEqual([])
  })
})
