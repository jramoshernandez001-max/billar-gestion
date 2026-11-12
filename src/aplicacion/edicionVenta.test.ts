/**
 * Pruebas de la edición de una venta.
 *
 * Qué hace: verifica que una venta guardada se convierta en un borrador listo
 * para corregir, que se pueda editar solo una venta vigente, y el motivo que
 * queda en la bitácora.
 * Cómo lo hace: ventas inventadas con precios de lista y precios cambiados.
 * Por qué: al equivocarse en el cierre del día, la persona solo quiere
 * cambiar lo errado sin volver a diligenciar toda la venta.
 */
import { describe, expect, it } from 'vitest'
import type { Venta } from '../domain/ventas/venta'
import { borradorDesdeVenta, motivoEdicion, ventaEditable } from './edicionVenta'

const cerveza = { unidadesPorCaja: 24, manejaSixpack: true, precioUnidad: 3000, precioCaja: 60000 }
const venta: Venta = {
  id: 'v1',
  fecha: '2026-11-03',
  estado: 'vigente',
  renglones: [
    { productoId: 'c', producto: cerveza, presentacion: 'caja', cantidad: 2, precioCobrado: 60000 },
    { productoId: 'c', producto: cerveza, presentacion: 'unidad', cantidad: 5, precioCobrado: 2500 },
  ],
}

describe('borradorDesdeVenta', () => {
  it('copia la fecha y los renglones en el mismo orden, con claves r1, r2…', () => {
    const b = borradorDesdeVenta(venta)
    expect(b.fecha).toBe('2026-11-03')
    expect(b.renglones.map((r) => r.clave)).toEqual(['r1', 'r2'])
    expect(b.renglones.map((r) => [r.productoId, r.presentacion, r.cantidad])).toEqual([
      ['c', 'caja', 2],
      ['c', 'unidad', 5],
    ])
  })

  it('deja vacío el precio que coincide con el de lista y conserva el que se cambió a mano', () => {
    const [caja, unidad] = borradorDesdeVenta(venta).renglones
    expect(caja.precioCobrado).toBeUndefined()
    expect(unidad.precioCobrado).toBe(2500)
  })
})

describe('ventaEditable', () => {
  it('encuentra la venta vigente por id', () => {
    expect(ventaEditable([venta], 'v1')).toBe(venta)
  })

  it('rechaza una venta que no existe o que ya está anulada', () => {
    expect(() => ventaEditable([venta], 'otra')).toThrow(/no existe/)
    expect(() => ventaEditable([{ ...venta, estado: 'anulada' }], 'v1')).toThrow(/anulada/)
  })
})

describe('motivoEdicion', () => {
  it('usa el motivo escrito, sin espacios sobrantes', () => {
    expect(motivoEdicion('  Se contó   mal  ')).toBe('Se contó mal')
  })

  it('sin motivo escrito usa "Venta editada"', () => {
    expect(motivoEdicion('   ')).toBe('Venta editada')
  })
})
