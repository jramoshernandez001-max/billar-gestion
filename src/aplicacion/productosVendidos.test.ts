/**
 * Pruebas del resumen de productos vendidos de un periodo.
 *
 * Qué hace: verifica que se sumen por producto las unidades y el valor de las
 * ventas vigentes dentro del periodo, con su desglose por presentación.
 * Cómo lo hace: ventas inventadas con distintas fechas, estados y precios.
 * Por qué: el detalle de un cierre debe mostrar qué se vendió ese día o esa
 * semana; una venta anulada o de otro día no debe aparecer.
 */
import { describe, expect, it } from 'vitest'
import type { Venta } from '../domain/ventas/venta'
import { resumirProductosVendidos } from './productosVendidos'

const cerveza = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const ron = { unidadesPorCaja: 1, manejaSixpack: false, categoria: 'licor' as const, precioUnidad: 50000, precioCaja: 50000 }

const catalogo = new Map([
  ['c', { nombre: 'Cerveza Ejemplo', categoria: 'cerveza' as const }],
  ['r', { nombre: 'Ron Ejemplo', categoria: 'licor' as const }],
])

const venta = (id: string, fecha: string, renglones: Venta['renglones'], estado: Venta['estado'] = 'vigente'): Venta => ({ id, fecha, estado, renglones })

describe('resumirProductosVendidos', () => {
  it('suma unidades y valor por producto, ordenado por valor', () => {
    const ventas = [
      venta('v1', '2026-11-03', [
        { productoId: 'c', producto: cerveza, presentacion: 'unidad', cantidad: 4 },
        { productoId: 'r', producto: ron, presentacion: 'unidad', cantidad: 1 },
      ]),
      venta('v2', '2026-11-03', [{ productoId: 'c', producto: cerveza, presentacion: 'caja', cantidad: 1 }]),
    ]
    const r = resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo)
    expect(r.filas).toEqual([
      { productoId: 'c', nombre: 'Cerveza Ejemplo', categoria: 'cerveza', unidades: 28, valor: 72000, desglose: '1 caja · 4 unidades' },
      { productoId: 'r', nombre: 'Ron Ejemplo', categoria: 'licor', unidades: 1, valor: 50000, desglose: '1 botella' },
    ])
    expect(r.totalUnidades).toBe(29)
    expect(r.totalValor).toBe(122000)
    expect(r.ventas).toBe(2)
  })

  it('usa el precio cobrado y no el de lista', () => {
    const ventas = [venta('v1', '2026-11-03', [{ productoId: 'c', producto: cerveza, presentacion: 'caja', cantidad: 1, precioCobrado: 65000 }])]
    expect(resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo).filas[0].valor).toBe(65000)
  })

  it('ignora ventas anuladas y de otros días, y cuenta solo las del periodo', () => {
    const r = [{ productoId: 'c', producto: cerveza, presentacion: 'unidad' as const, cantidad: 2 }]
    const ventas = [
      venta('v1', '2026-11-03', r),
      venta('v2', '2026-11-03', r, 'anulada'),
      venta('v3', '2026-11-02', r),
      venta('v4', '2026-11-05', r),
    ]
    const resumen = resumirProductosVendidos(ventas, '2026-11-03', '2026-11-04', catalogo)
    expect(resumen.ventas).toBe(1)
    expect(resumen.filas[0].unidades).toBe(2)
  })

  it('en una semana junta todos los días', () => {
    const r = [{ productoId: 'c', producto: cerveza, presentacion: 'unidad' as const, cantidad: 1 }]
    const ventas = [venta('v1', '2026-11-02', r), venta('v2', '2026-11-08', r)]
    const resumen = resumirProductosVendidos(ventas, '2026-11-02', '2026-11-08', catalogo)
    expect(resumen.filas).toHaveLength(1)
    expect(resumen.filas[0].unidades).toBe(2)
  })

  it('ignora renglones de cantidad cero y desglosa sixpacks', () => {
    const ventas = [venta('v1', '2026-11-03', [
      { productoId: 'c', producto: cerveza, presentacion: 'sixpack', cantidad: 2 },
      { productoId: 'r', producto: ron, presentacion: 'unidad', cantidad: 0 },
    ])]
    const r = resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo)
    expect(r.filas.map((f) => f.productoId)).toEqual(['c'])
    expect(r.filas[0].desglose).toBe('2 sixpacks')
    expect(r.filas[0].unidades).toBe(12)
  })

  it('sin ventas devuelve todo en cero', () => {
    expect(resumirProductosVendidos([], '2026-11-03', '2026-11-03', catalogo)).toEqual({ filas: [], totalUnidades: 0, totalValor: 0, ventas: 0, cajasCerveza: { cajas: 0, sueltas: 0 } })
  })

  it('un producto que ya no está en el catálogo se muestra como "Producto"', () => {
    const ventas = [venta('v1', '2026-11-03', [{ productoId: 'x', producto: cerveza, presentacion: 'unidad', cantidad: 1 }])]
    const r = resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo)
    expect(r.filas[0]).toMatchObject({ nombre: 'Producto', categoria: 'cerveza' })
  })

  describe('cajas de cerveza vendidas (equivalente)', () => {
    const otra = { unidadesPorCaja: 38, manejaSixpack: false, precioUnidad: 3000, precioCaja: 100000 }
    const conOtra = new Map([...catalogo, ['o', { nombre: 'Otra Ejemplo', categoria: 'cerveza' as const }]])

    it('convierte unidades, sixpacks y cajas de cada cerveza a cajas de ese producto', () => {
      const ventas = [
        venta('v1', '2026-11-02', [
          { productoId: 'o', producto: otra, presentacion: 'caja', cantidad: 1 },
          { productoId: 'o', producto: otra, presentacion: 'unidad', cantidad: 40 },
        ]),
        venta('v2', '2026-11-07', [
          { productoId: 'c', producto: cerveza, presentacion: 'sixpack', cantidad: 4 },
          { productoId: 'c', producto: cerveza, presentacion: 'unidad', cantidad: 3 },
        ]),
      ]
      // Otra: 78 u ÷ 38 = 2 cajas y 2 sueltas. Cerveza: 27 u ÷ 24 = 1 caja y 3 sueltas.
      const r = resumirProductosVendidos(ventas, '2026-11-02', '2026-11-08', conOtra)
      expect(r.cajasCerveza).toEqual({ cajas: 3, sueltas: 5 })
    })

    it('no cuenta licores ni otros productos', () => {
      const ventas = [venta('v1', '2026-11-03', [{ productoId: 'r', producto: ron, presentacion: 'unidad', cantidad: 5 }])]
      expect(resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo).cajasCerveza).toEqual({ cajas: 0, sueltas: 0 })
    })

    it('ignora las ventas anuladas', () => {
      const ventas = [venta('v1', '2026-11-03', [{ productoId: 'c', producto: cerveza, presentacion: 'caja', cantidad: 2 }], 'anulada')]
      expect(resumirProductosVendidos(ventas, '2026-11-03', '2026-11-03', catalogo).cajasCerveza).toEqual({ cajas: 0, sueltas: 0 })
    })
  })
})
