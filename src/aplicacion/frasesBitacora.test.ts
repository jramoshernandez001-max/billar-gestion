/**
 * Pruebas de las frases de la bitácora.
 *
 * Qué hace: verifica que cada acción se cuente en una frase clara, con
 * cantidades en cajas o botellas, nombres de producto y pesos.
 * Cómo lo hace: entradas inventadas con la misma forma que guarda la base.
 * Por qué: la persona lee la bitácora en el celular; cada frase debe decir
 * qué pasó sin abrir el detalle.
 */
import { describe, it, expect } from 'vitest'
import type { EntradaBitacora } from '../datos/bitacora'
import { fraseDe, type ProductoBitacora } from './frasesBitacora'

const productos = new Map<string, ProductoBitacora>([
  ['c1', { nombre: 'Cerveza Ejemplo', categoria: 'cerveza', unidadesPorCaja: 30 }],
  ['c2', { nombre: 'Lata Ejemplo', categoria: 'cerveza', unidadesPorCaja: 24 }],
  ['l1', { nombre: 'Licor Ejemplo', categoria: 'licor', unidadesPorCaja: 1 }],
])

function e(sobre: Partial<EntradaBitacora>): EntradaBitacora {
  return {
    id: 'x',
    usuario: 'ana@ejemplo.com',
    accion: 'registrar-compra',
    tabla: 'compras',
    registroId: 'r',
    antes: null,
    despues: {},
    motivo: null,
    momento: '2026-11-08T15:00:00.000Z',
    ...sobre,
  }
}

const frase = (sobre: Partial<EntradaBitacora>) => fraseDe(e(sobre), productos)

describe('fraseDe: compras', () => {
  it('compra por cajas: cantidad, producto, unidades, costo, número y fecha', () => {
    expect(frase({ despues: { producto_id: 'c1', presentacion: 'caja', cantidad: 3, unidades: 90, costo_total: 240000, numero: 7, fecha: '2026-11-08' } }))
      .toBe('Se compraron 3 cajas de Cerveza Ejemplo (90 unidades) por $ 240.000. Compra C-007 del 2026-11-08.')
  })

  it('una sola caja va en singular', () => {
    expect(frase({ despues: { producto_id: 'c1', presentacion: 'caja', cantidad: 1, unidades: 30, costo_total: 80000, numero: 1, fecha: '2026-11-08' } }))
      .toBe('Se compró 1 caja de Cerveza Ejemplo (30 unidades) por $ 80.000. Compra C-001 del 2026-11-08.')
  })

  it('el licor se cuenta en botellas', () => {
    expect(frase({ despues: { producto_id: 'l1', presentacion: 'unidad', cantidad: 6, unidades: 6, costo_total: 300000, numero: 2, fecha: '2026-11-08' } }))
      .toBe('Se compraron 6 botellas de Licor Ejemplo por $ 300.000. Compra C-002 del 2026-11-08.')
  })

  it('corrección de costo: de cuánto a cuánto', () => {
    expect(frase({
      accion: 'corregir-costo-compra',
      antes: { producto_id: 'c1', numero: 7, costo_total: 240000 },
      despues: { producto_id: 'c1', numero: 7, costo_total: 250000 },
    })).toBe('Se corrigió el costo de la compra C-007 de Cerveza Ejemplo: pasó de $ 240.000 a $ 250.000.')
  })

  it('compra anulada: qué se anuló y que se descontó del inventario', () => {
    expect(frase({
      accion: 'anular-registro',
      antes: { producto_id: 'c1', presentacion: 'caja', cantidad: 3, unidades: 90, costo_total: 240000, numero: 7, estado: 'vigente' },
      despues: { producto_id: 'c1', presentacion: 'caja', cantidad: 3, unidades: 90, costo_total: 240000, numero: 7, estado: 'anulada' },
    })).toBe('Se anuló la compra C-007: 3 cajas de Cerveza Ejemplo por $ 240.000. Sus unidades se descontaron del inventario.')
  })
})

describe('fraseDe: inventario', () => {
  it('traslado en cajas y unidades sueltas', () => {
    expect(frase({ accion: 'registrar-traslado', tabla: 'movimientos_inventario', despues: { producto_id: 'c1', unidades: 65 } }))
      .toBe('Se pasaron 2 cajas y 5 unidades de Cerveza Ejemplo (65 unidades) de la bodega a la nevera.')
  })

  it('traslado de cajas exactas', () => {
    expect(frase({ accion: 'registrar-traslado', tabla: 'movimientos_inventario', despues: { producto_id: 'c2', unidades: 24 } }))
      .toBe('Se pasó 1 caja de Lata Ejemplo (24 unidades) de la bodega a la nevera.')
  })

  it('traslado de menos de una caja', () => {
    expect(frase({ accion: 'registrar-traslado', tabla: 'movimientos_inventario', despues: { producto_id: 'c1', unidades: 5 } }))
      .toBe('Se pasaron 5 unidades de Cerveza Ejemplo de la bodega a la nevera.')
  })

  it('ajuste que suma y ajuste que quita', () => {
    expect(frase({ accion: 'registrar-ajuste', tabla: 'movimientos_inventario', despues: { producto_id: 'c1', ubicacion: 'nevera', unidades: 5 } }))
      .toBe('Se ajustó el inventario de Cerveza Ejemplo en la nevera: se sumaron 5 unidades.')
    expect(frase({ accion: 'registrar-ajuste', tabla: 'movimientos_inventario', despues: { producto_id: 'l1', ubicacion: 'bodega', unidades: -1 } }))
      .toBe('Se ajustó el inventario de Licor Ejemplo en la bodega: se quitó 1 botella.')
  })
})

describe('fraseDe: ventas', () => {
  const renglones = [
    { producto_id: 'c1', presentacion: 'caja', cantidad: 2, precio_cobrado: 100000 },
    { producto_id: 'c2', presentacion: 'unidad', cantidad: 3, precio_cobrado: 4000 },
    { producto_id: 'l1', presentacion: 'unidad', cantidad: 1, precio_cobrado: 60000 },
  ]

  it('venta: lo vendido, el total y la fecha', () => {
    expect(frase({ accion: 'registrar-venta', tabla: 'ventas', despues: { fecha: '2026-11-08', estado: 'vigente', renglones } }))
      .toBe('Se vendieron 2 cajas de Cerveza Ejemplo, 3 unidades de Lata Ejemplo y 1 botella de Licor Ejemplo por $ 272.000 (venta del 2026-11-08).')
  })

  it('venta anulada: lo que se anuló y que volvió a la nevera', () => {
    expect(frase({
      accion: 'anular-registro',
      tabla: 'ventas',
      antes: { fecha: '2026-11-08', estado: 'vigente', renglones: renglones.slice(0, 1) },
      despues: { fecha: '2026-11-08', estado: 'anulada', renglones: renglones.slice(0, 1) },
    })).toBe('Se anuló la venta del 2026-11-08 (2 cajas de Cerveza Ejemplo) por $ 200.000. Sus unidades volvieron a la nevera.')
  })
})

describe('fraseDe: deudas', () => {
  it('deuda: quién, cuánto, cuándo y por qué', () => {
    expect(frase({ accion: 'registrar-deuda', tabla: 'deudas', despues: { cliente: 'Pedro', monto: 30000, fecha: '2026-11-08', descripcion: '10 cervezas' } }))
      .toBe('Pedro quedó debiendo $ 30.000 el 2026-11-08 por: 10 cervezas.')
  })

  it('abono y anulaciones', () => {
    expect(frase({ accion: 'registrar-abono', tabla: 'abonos_deuda', despues: { monto: 10000, fecha: '2026-11-09', descripcion: 'pago parcial' } }))
      .toBe('Se recibió un abono de $ 10.000 el 2026-11-09 por: pago parcial.')
    expect(frase({ accion: 'anular-registro', tabla: 'deudas', despues: { cliente: 'Pedro', monto: 30000, estado: 'anulada' } }))
      .toBe('Se anuló la deuda de Pedro por $ 30.000.')
    expect(frase({ accion: 'anular-registro', tabla: 'abonos_deuda', despues: { monto: 10000, fecha: '2026-11-09', estado: 'anulada' } }))
      .toBe('Se anuló el abono de $ 10.000 del 2026-11-09.')
  })
})

describe('fraseDe: cierres', () => {
  it('cierre diario con faltante', () => {
    expect(frase({
      accion: 'registrar-cierre-diario',
      tabla: 'cierres',
      despues: { tipo: 'diario', desde: '2026-11-08', hasta: '2026-11-08', efectivo: 50000, transferencias: 20000, resultado: { cuadra: false, faltante: 5000, sobrante: 0 } },
    })).toBe('Se hizo el cierre del día 2026-11-08: se contaron $ 50.000 en efectivo y $ 20.000 en transferencias. Faltaron $ 5.000.')
  })

  it('cierre semanal que cuadra, con o sin sobrante', () => {
    const base = { tipo: 'semanal', desde: '2026-11-02', hasta: '2026-11-08', efectivo: 100000, transferencias: 0 }
    expect(frase({ accion: 'registrar-cierre-semanal', tabla: 'cierres', despues: { ...base, resultado: { cuadra: true, faltante: 0, sobrante: 0 } } }))
      .toBe('Se hizo el cierre de la semana del 2026-11-02 al 2026-11-08: se contaron $ 100.000 en efectivo y $ 0 en transferencias. Cuadró.')
    expect(frase({ accion: 'recalcular-cierre-semanal', tabla: 'cierres', despues: { ...base, resultado: { cuadra: true, faltante: 0, sobrante: 2000 } } }))
      .toBe('Se recalculó el cierre de la semana del 2026-11-02 al 2026-11-08: se contaron $ 100.000 en efectivo y $ 0 en transferencias. Sobraron $ 2.000.')
  })

  it('corrección del dinero: solo lo que cambió', () => {
    expect(frase({
      accion: 'corregir-dinero-cierre',
      tabla: 'cierres',
      antes: { tipo: 'diario', desde: '2026-11-08', hasta: '2026-11-08', efectivo: 50000, transferencias: 20000 },
      despues: { tipo: 'diario', desde: '2026-11-08', hasta: '2026-11-08', efectivo: 55000, transferencias: 20000 },
    })).toBe('Se corrigió el dinero del cierre del día 2026-11-08: el efectivo pasó de $ 50.000 a $ 55.000.')
  })
})

describe('fraseDe: productos', () => {
  it('cambio de precio: unidad y caja', () => {
    expect(frase({
      accion: 'cambiar-precio',
      tabla: 'productos',
      antes: { nombre: 'Cerveza Ejemplo', precio_unidad: 3000, precio_caja: 90000 },
      despues: { nombre: 'Cerveza Ejemplo', precio_unidad: 3500, precio_caja: 100000 },
    })).toBe('Se cambió el precio de Cerveza Ejemplo: la unidad pasó de $ 3.000 a $ 3.500 y la caja de $ 90.000 a $ 100.000.')
  })

  it('producto nuevo: cerveza y licor', () => {
    expect(frase({ accion: 'crear-producto', tabla: 'productos', despues: { nombre: 'Nueva', categoria: 'cerveza', unidades_por_caja: 24, precio_unidad: 4000, precio_caja: 96000 } }))
      .toBe('Se creó el producto Nueva (cerveza, caja de 24 unidades): unidad a $ 4.000 y caja a $ 96.000.')
    expect(frase({ accion: 'crear-producto', tabla: 'productos', despues: { nombre: 'Ron', categoria: 'licor', unidades_por_caja: 1, precio_unidad: 50000, precio_caja: 50000 } }))
      .toBe('Se creó el licor Ron: botella a $ 50.000.')
  })

  it('producto editado: los cambios en palabras', () => {
    expect(frase({
      accion: 'editar-producto',
      tabla: 'productos',
      antes: { nombre: 'Vieja', unidades_por_caja: 24 },
      despues: { nombre: 'Nueva', unidades_por_caja: 30 },
    })).toBe('Se editó el producto Nueva: nombre de "Vieja" a "Nueva" y unidades por caja de 24 a 30.')
  })
})

describe('fraseDe: datos incompletos', () => {
  it('un producto que ya no se conoce se nombra como "un producto"', () => {
    expect(frase({ accion: 'registrar-traslado', tabla: 'movimientos_inventario', despues: { producto_id: 'otro', unidades: 10 } }))
      .toBe('Se pasaron 10 unidades de un producto de la bodega a la nevera.')
  })
})
