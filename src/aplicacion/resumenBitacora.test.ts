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
import { comparar, grupoDe, resumirBitacora, tituloDe } from './resumenBitacora'
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
