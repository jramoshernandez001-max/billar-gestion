/**
 * Pruebas del resumen de inventario.
 *
 * Qué hace: verifica la tabla de stock por producto: bodega, nevera, total,
 * su equivalente en cajas y sixpacks, y el aviso de stock negativo.
 * Cómo lo hace: productos y stock inventados, con cuentas hechas a mano.
 * Por qué: el stock se guarda en unidades, pero a la gente le sirve verlo
 * como "2 cajas y 5 sueltas"; el stock negativo indica un registro faltante
 * (por ejemplo una compra sin cargar) y debe verse.
 */
import { describe, it, expect } from 'vitest'
import { resumirInventario, totalizarCajas } from './resumenInventario'

const productos = [
  { id: 'p1', nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true },
  { id: 'p2', nombre: 'Gaseosa Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 12, manejaSixpack: false },
  { id: 'p3', nombre: 'Agua Ejemplo', categoria: 'cerveza' as const, unidadesPorCaja: 20, manejaSixpack: false },
]

/** Busca la fila de un producto (el resultado va ordenado por nombre). */
const de = (filas: ReturnType<typeof resumirInventario>, id: string) => {
  const fila = filas.find((f) => f.productoId === id)
  if (fila === undefined) throw new Error(`falta la fila de ${id}`)
  return fila
}

describe('resumirInventario', () => {
  it('muestra bodega, nevera y total por producto', () => {
    const stock = new Map([['p1', { bodega: 48, nevera: 12, total: 60 }]])
    const fila = de(resumirInventario(productos, stock), 'p1')
    expect(fila).toMatchObject({ productoId: 'p1', nombre: 'Cerveza Ejemplo', bodega: 48, nevera: 12, total: 60 })
  })

  it('expresa el total en cajas, sixpacks y sueltas cuando el producto maneja sixpack', () => {
    // 60 = 2 cajas (48) + 12 → 2 sixpacks + 0 sueltas
    const fila = de(resumirInventario(productos, new Map([['p1', { bodega: 48, nevera: 12, total: 60 }]])), 'p1')
    expect(fila.equivalente).toEqual({ cajas: 2, sixpacks: 2, sueltas: 0 })
    // 67 = 2 cajas + 19 → 3 sixpacks (18) + 1 suelta
    const otra = de(resumirInventario(productos, new Map([['p1', { bodega: 50, nevera: 17, total: 67 }]])), 'p1')
    expect(otra.equivalente).toEqual({ cajas: 2, sixpacks: 3, sueltas: 1 })
  })

  it('sin sixpack, los sixpacks son cero y el resto queda suelto', () => {
    // 29 = 2 cajas de 12 + 5
    const fila = de(resumirInventario(productos, new Map([['p2', { bodega: 24, nevera: 5, total: 29 }]])), 'p2')
    expect(fila.equivalente).toEqual({ cajas: 2, sixpacks: 0, sueltas: 5 })
  })

  it('un producto sin movimientos aparece en cero', () => {
    const fila = de(resumirInventario(productos, new Map()), 'p3')
    expect(fila).toMatchObject({ bodega: 0, nevera: 0, total: 0, negativo: false })
    expect(fila.equivalente).toEqual({ cajas: 0, sixpacks: 0, sueltas: 0 })
  })

  it('avisa si alguna ubicación quedó negativa y no inventa equivalentes', () => {
    const fila = de(resumirInventario(productos, new Map([['p1', { bodega: 10, nevera: -3, total: 7 }]])), 'p1')
    expect(fila.negativo).toBe(true)
    expect(fila.equivalente).toBeNull()
    expect(de(resumirInventario(productos, new Map([['p1', { bodega: 10, nevera: 3, total: 13 }]])), 'p1').negativo).toBe(false)
  })

  it('ordena por nombre sin importar mayúsculas', () => {
    const lista = resumirInventario([...productos].reverse(), new Map())
    expect(lista.map((f) => f.nombre)).toEqual(['Agua Ejemplo', 'Cerveza Ejemplo', 'Gaseosa Ejemplo'])
  })

  it('un licor no se expresa en cajas: sin equivalente y con su categoría', () => {
    const licor = { id: 'l', nombre: 'Aguardiente Ejemplo', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false }
    const filas = resumirInventario([licor], new Map([['l', { bodega: 5, nevera: 2, total: 7 }]]))
    expect(filas[0]).toMatchObject({ categoria: 'licor', total: 7, equivalente: null })
  })
})

describe('totalizarCajas', () => {
  const catalogo = [
    { id: 'c1', nombre: 'Cerveza A', categoria: 'cerveza' as const, unidadesPorCaja: 30, manejaSixpack: false },
    { id: 'c2', nombre: 'Cerveza B', categoria: 'cerveza' as const, unidadesPorCaja: 24, manejaSixpack: true },
    { id: 'l1', nombre: 'Licor A', categoria: 'licor' as const, unidadesPorCaja: 1, manejaSixpack: false },
  ]

  it('suma cajas completas y sueltas por ubicación y en general, producto por producto', () => {
    // c1: bodega 60 (2 cajas), nevera 35 (1 caja + 5), total 95 (3 cajas + 5)
    // c2: bodega 24 (1 caja), nevera 10 (0 + 10), total 34 (1 caja + 10)
    const stock = new Map([
      ['c1', { bodega: 60, nevera: 35, total: 95 }],
      ['c2', { bodega: 24, nevera: 10, total: 34 }],
    ])
    const totales = totalizarCajas(resumirInventario(catalogo, stock))
    expect(totales).toEqual({
      bodega: { cajas: 3, sueltas: 0 },
      nevera: { cajas: 1, sueltas: 15 },
      general: { cajas: 4, sueltas: 15 },
    })
  })

  it('no cuenta el licor, que se maneja por botella y no por caja', () => {
    const stock = new Map([['l1', { bodega: 5, nevera: 2, total: 7 }]])
    const totales = totalizarCajas(resumirInventario(catalogo, stock))
    expect(totales.general).toEqual({ cajas: 0, sueltas: 0 })
  })

  it('un stock negativo no inventa cajas: queda como sueltas negativas', () => {
    const stock = new Map([['c1', { bodega: -3, nevera: 30, total: 27 }]])
    const totales = totalizarCajas(resumirInventario(catalogo, stock))
    expect(totales.bodega).toEqual({ cajas: 0, sueltas: -3 })
    expect(totales.nevera).toEqual({ cajas: 1, sueltas: 0 })
  })

  it('sin productos, todo en cero', () => {
    expect(totalizarCajas([]).general).toEqual({ cajas: 0, sueltas: 0 })
  })
})
