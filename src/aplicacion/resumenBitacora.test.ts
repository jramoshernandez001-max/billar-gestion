/**
 * Pruebas del resumen de la bitácora.
 *
 * Qué hace: verifica los títulos en español, los grupos, los filtros, el orden,
 * la paginación y la comparación de antes y después.
 * Cómo lo hace: entradas inventadas con registros hechos a mano.
 * Por qué: la bitácora es la prueba de quién cambió qué; debe leerse sin
 * conocer los nombres de las columnas de la base.
 */
import { describe, it, expect } from 'vitest'
import { ACCIONES_BITACORA } from '../domain/compartido/bitacora'
import { comparar, dondeDe, grupoDe, resumirBitacora, tituloDe } from './resumenBitacora'
import type { EntradaBitacora } from '../datos/bitacora'

const entrada = (id: string, momento: string, sobre: Partial<EntradaBitacora> = {}): EntradaBitacora => ({
  id, momento, usuario: 'ana@ejemplo.com', accion: 'registrar-venta', tabla: 'ventas', registroId: 'r', antes: null, despues: {}, motivo: null, ...sobre,
})

describe('tituloDe y grupoDe', () => {
  it('toda acción tiene título en español', () => {
    for (const a of ACCIONES_BITACORA) expect(tituloDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: a })), a).not.toMatch(/-/)
  })

  it('anular-registro toma el título y el grupo de la tabla', () => {
    expect(tituloDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: 'anular-registro', tabla: 'compras' }))).toBe('Compra anulada')
    expect(tituloDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: 'anular-registro', tabla: 'abonos_deuda' }))).toBe('Abono anulado')
    expect(grupoDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: 'anular-registro', tabla: 'deudas' }))).toBe('deudas')
    expect(grupoDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: 'registrar-traslado', tabla: 'movimientos_inventario' }))).toBe('inventario')
    expect(grupoDe(entrada('x', '2026-11-01T10:00:00.000Z', { accion: 'recalcular-cierre-semanal', tabla: 'cierres' }))).toBe('cierres')
  })
})

describe('resumirBitacora', () => {
  const lista = [
    entrada('a', '2026-11-01T10:00:00.000Z'),
    entrada('b', '2026-11-03T10:00:00.000Z', { accion: 'registrar-compra', tabla: 'compras', usuario: 'beto@ejemplo.com' }),
    entrada('c', '2026-11-02T10:00:00.000Z', { accion: 'anular-registro', tabla: 'ventas', motivo: 'duplicada' }),
  ]

  it('ordena de la más reciente a la más antigua', () => {
    expect(resumirBitacora({ entradas: lista, grupo: 'todos', usuario: null, limite: 10 }).tarjetas.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('filtra por grupo y por usuario', () => {
    expect(resumirBitacora({ entradas: lista, grupo: 'ventas', usuario: null, limite: 10 }).tarjetas.map((t) => t.id)).toEqual(['c', 'a'])
    expect(resumirBitacora({ entradas: lista, grupo: 'todos', usuario: 'beto@ejemplo.com', limite: 10 }).tarjetas.map((t) => t.id)).toEqual(['b'])
  })

  it('pagina y dice el total', () => {
    const r = resumirBitacora({ entradas: lista, grupo: 'todos', usuario: null, limite: 2 })
    expect(r.tarjetas).toHaveLength(2)
    expect(r.total).toBe(3)
  })

  it('lista los usuarios distintos', () => {
    expect(resumirBitacora({ entradas: lista, grupo: 'todos', usuario: null, limite: 10 }).usuarios).toEqual(['ana@ejemplo.com', 'beto@ejemplo.com'])
  })

  it('la tarjeta lleva título, usuario, motivo y hora ISO', () => {
    const t = resumirBitacora({ entradas: lista, grupo: 'ventas', usuario: null, limite: 10 }).tarjetas[0]
    expect(t).toMatchObject({ titulo: 'Venta anulada', usuario: 'ana@ejemplo.com', motivo: 'duplicada', momento: '2026-11-02T10:00:00.000Z' })
  })
})

describe('comparar', () => {
  it('muestra solo lo que cambió, con nombres y valores legibles', () => {
    expect(comparar({ id: '1', estado: 'vigente', costo_total: 96000, creado_en: 'x' }, { id: '1', estado: 'anulada', costo_total: 100000, creado_en: 'x' })).toEqual([
      { campo: 'Estado', antes: 'Vigente', despues: 'Anulada' },
      { campo: 'Costo total', antes: '$ 96.000', despues: '$ 100.000' },
    ])
  })

  it('sin antes (registro nuevo) muestra los datos del registro, sin ids ni marcas internas', () => {
    expect(comparar(null, { id: '1', creado_por: 'u', cliente: 'Ana', monto: 15000, maneja_sixpack: true })).toEqual([
      { campo: 'Cliente', antes: '—', despues: 'Ana' },
      { campo: 'Monto', antes: '—', despues: '$ 15.000' },
      { campo: 'Maneja sixpack', antes: '—', despues: 'Sí' },
    ])
  })

  it('un campo desconocido usa su nombre sin guiones bajos', () => {
    expect(comparar({ tipo_raro: 1 }, { tipo_raro: 2 })).toEqual([{ campo: 'Tipo raro', antes: '1', despues: '2' }])
  })
})

describe('comparar: renglones de venta y datos internos', () => {
  const nombres = new Map([['p1', 'Águila'], ['p2', 'Poker']])

  it('muestra los renglones de una venta como "cantidad × presentación producto"', () => {
    const renglones = [
      { producto_id: 'p1', presentacion: 'caja', cantidad: 2 },
      { producto_id: 'p2', presentacion: 'unidad', cantidad: 3 },
    ]
    expect(comparar(null, { fecha: '2026-11-08', renglones }, nombres)).toContainEqual(
      { campo: 'Renglones', antes: '—', despues: '2 × caja Águila, 3 × unidad Poker' },
    )
  })

  it('no muestra los cálculos internos de un cierre (JSON)', () => {
    const cambios = comparar({ efectivo: 1000, resultado: { a: 1 }, costos_usados: [] }, { efectivo: 2000, resultado: { a: 2 }, costos_usados: [1] })
    expect(cambios).toEqual([{ campo: 'Efectivo', antes: '$ 1.000', despues: '$ 2.000' }])
  })
})

describe('dondeDe', () => {
  const nombres = new Map([['p1', 'Águila'], ['p2', 'Poker']])
  const e = (sobre: Partial<EntradaBitacora>) => entrada('x', '2026-11-01T10:00:00.000Z', sobre)

  it('producto: la sección y el nombre del producto', () => {
    expect(dondeDe(e({ accion: 'editar-producto', tabla: 'productos', despues: { nombre: 'Águila' } }), nombres)).toBe('Productos · Águila')
  })

  it('compra: el producto y su número', () => {
    expect(dondeDe(e({ accion: 'registrar-compra', tabla: 'compras', despues: { producto_id: 'p2', numero: 7 } }), nombres)).toBe('Compras · Poker · C-007')
  })

  it('traslado: el producto y de dónde a dónde', () => {
    expect(dondeDe(e({ accion: 'registrar-traslado', tabla: 'movimientos_inventario', despues: { producto_id: 'p1', unidades: 30 } }), nombres)).toBe('Inventario · Águila · Bodega → Nevera')
  })

  it('ajuste: el producto y la ubicación', () => {
    expect(dondeDe(e({ accion: 'registrar-ajuste', tabla: 'movimientos_inventario', despues: { producto_id: 'p1', ubicacion: 'nevera' } }), nombres)).toBe('Inventario · Águila · Nevera')
  })

  it('venta: la fecha y los productos vendidos, sin repetir', () => {
    const despues = { fecha: '2026-11-08', renglones: [{ producto_id: 'p1' }, { producto_id: 'p2' }, { producto_id: 'p1' }] }
    expect(dondeDe(e({ despues }), nombres)).toBe('Ventas · 2026-11-08 · Águila, Poker')
  })

  it('deuda: el cliente; abono: la deuda', () => {
    expect(dondeDe(e({ accion: 'registrar-deuda', tabla: 'deudas', despues: { cliente: 'Pedro' } }), nombres)).toBe('Deudas · Pedro')
    expect(dondeDe(e({ accion: 'registrar-abono', tabla: 'abonos_deuda', despues: { fecha: '2026-11-08' } }), nombres)).toBe('Deudas · Abono')
  })

  it('cierre: el tipo y el periodo', () => {
    expect(dondeDe(e({ accion: 'registrar-cierre-diario', tabla: 'cierres', despues: { tipo: 'diario', desde: '2026-11-08', hasta: '2026-11-08' } }), nombres)).toBe('Cierres · Diario 2026-11-08')
    expect(dondeDe(e({ accion: 'recalcular-cierre-semanal', tabla: 'cierres', despues: { tipo: 'semanal', desde: '2026-11-02', hasta: '2026-11-08' } }), nombres)).toBe('Cierres · Semanal 2026-11-02 a 2026-11-08')
  })

  it('un producto que ya no se conoce no rompe: se omite su nombre', () => {
    expect(dondeDe(e({ accion: 'registrar-compra', tabla: 'compras', despues: { producto_id: 'otro' } }), nombres)).toBe('Compras')
  })
})
