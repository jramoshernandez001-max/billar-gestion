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
import { resumirInventario } from './resumenInventario'

const productos = [
  { id: 'p1', nombre: 'Cerveza Ejemplo', unidadesPorCaja: 24, manejaSixpack: true },
  { id: 'p2', nombre: 'Gaseosa Ejemplo', unidadesPorCaja: 12, manejaSixpack: false },
  { id: 'p3', nombre: 'Agua Ejemplo', unidadesPorCaja: 20, manejaSixpack: false },
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
})
