/**
 * Pruebas del manejo de deudas y abonos.
 *
 * Qué hace: verifica el saldo pendiente de una deuda a una fecha de corte y el
 * total de deudas que entran en el cierre de un periodo (día o semana).
 * Cómo lo hace: arma deudas y abonos de ejemplo con fechas concretas y compara
 * el resultado de cada función con lo esperado a mano.
 * Por qué: las deudas se suman al dinero para cuadrar el cierre. Si entra una
 * deuda que ya se pagó, o se deja por fuera una que sigue pendiente, el cierre
 * da un cuadre falso.
 */
import { describe, it, expect } from 'vitest'
import {
  saldoPendiente,
  totalDeudasPendientes,
  type Abono,
  type Deuda,
} from './deudas'

/** Crea una deuda de ejemplo. */
const deuda = (id: string, fecha: string, monto: number): Deuda => ({
  id,
  cliente: 'Cliente de ejemplo',
  fecha,
  monto,
  descripcion: 'Consumo fiado de ejemplo',
  estado: 'vigente',
})

/** Crea un abono de ejemplo. */
const abono = (deudaId: string, fecha: string, monto: number): Abono => ({
  id: `${deudaId}-${fecha}-${monto}`,
  deudaId,
  fecha,
  monto,
  descripcion: 'Abono de ejemplo',
  estado: 'vigente',
})

describe('saldoPendiente', () => {
  const d = deuda('d1', '2026-11-02', 50000)

  it('no cuenta los abonos anulados', () => {
    const anulado: Abono = { ...abono('d1', '2026-11-03', 20000), estado: 'anulada' }
    expect(saldoPendiente(d, [anulado, abono('d1', '2026-11-04', 5000)], '2026-11-08')).toBe(45000)
  })

  it('una deuda anulada ya no debe nada', () => {
    expect(saldoPendiente({ ...d, estado: 'anulada' }, [], '2026-11-08')).toBe(0)
  })

  it('rechaza una deuda o un abono con estado desconocido', () => {
    expect(() => saldoPendiente({ ...d, estado: 'borrada' as Deuda['estado'] }, [], '2026-11-08')).toThrow(/estado/i)
    const raro: Abono = { ...abono('d1', '2026-11-03', 1000), estado: 'borrada' as Abono['estado'] }
    expect(() => saldoPendiente(d, [raro], '2026-11-08')).toThrow(/estado/i)
  })

  it('rechaza una deuda sin descripción válida', () => {
    expect(() => saldoPendiente({ ...d, descripcion: '' }, [], '2026-11-08')).toThrow(/descripción/i)
    expect(() => saldoPendiente({ ...d, descripcion: ' fiado' }, [], '2026-11-08')).toThrow(/espacios/i)
    expect(() => saldoPendiente({ ...d, descripcion: 'a'.repeat(201) }, [], '2026-11-08')).toThrow(/200/)
  })

  it('rechaza un abono sin descripción válida', () => {
    const malo = { ...abono('d1', '2026-11-03', 1000), descripcion: '   ' }
    expect(() => saldoPendiente(d, [malo], '2026-11-08')).toThrow(/descripción/i)
  })

  it('sin abonos el saldo es todo el monto', () => {
    expect(saldoPendiente(d, [], '2026-11-08')).toBe(50000)
  })

  it('un abono parcial reduce el saldo', () => {
    const abonos = [abono('d1', '2026-11-04', 20000)]
    expect(saldoPendiente(d, abonos, '2026-11-08')).toBe(30000)
  })

  it('varios abonos se suman', () => {
    const abonos = [
      abono('d1', '2026-11-03', 10000),
      abono('d1', '2026-11-05', 15000),
    ]
    expect(saldoPendiente(d, abonos, '2026-11-08')).toBe(25000)
  })

  it('una deuda pagada completa queda en cero', () => {
    const abonos = [abono('d1', '2026-11-04', 50000)]
    expect(saldoPendiente(d, abonos, '2026-11-08')).toBe(0)
  })

  it('ignora los abonos hechos después de la fecha de corte', () => {
    const abonos = [abono('d1', '2026-11-10', 50000)]
    expect(saldoPendiente(d, abonos, '2026-11-08')).toBe(50000)
  })

  it('ignora los abonos de otras deudas', () => {
    const abonos = [abono('otra', '2026-11-04', 50000)]
    expect(saldoPendiente(d, abonos, '2026-11-08')).toBe(50000)
  })

  it('rechaza abonos que superan el monto de la deuda', () => {
    const abonos = [abono('d1', '2026-11-04', 60000)]
    expect(() => saldoPendiente(d, abonos, '2026-11-08')).toThrow()
  })

  it('rechaza fechas con formato inválido', () => {
    expect(() => saldoPendiente(d, [], '08/11/2026')).toThrow()
  })
})

describe('totalDeudasPendientes', () => {
  const desde = '2026-11-02'
  const hasta = '2026-11-08'

  it('sin deudas el total es cero', () => {
    expect(totalDeudasPendientes([], [], desde, hasta)).toBe(0)
  })

  it('suma las deudas nacidas en el periodo que siguen sin pagar', () => {
    const deudas = [
      deuda('d1', '2026-11-02', 50000),
      deuda('d2', '2026-11-03', 30000),
    ]
    expect(totalDeudasPendientes(deudas, [], desde, hasta)).toBe(80000)
  })

  it('no incluye una deuda pagada completa dentro del periodo', () => {
    const deudas = [deuda('d1', '2026-11-02', 50000)]
    const abonos = [abono('d1', '2026-11-04', 50000)]
    expect(totalDeudasPendientes(deudas, abonos, desde, hasta)).toBe(0)
  })

  it('con un abono parcial incluye solo lo que sigue debiéndose', () => {
    const deudas = [deuda('d1', '2026-11-02', 50000)]
    const abonos = [abono('d1', '2026-11-04', 20000)]
    expect(totalDeudasPendientes(deudas, abonos, desde, hasta)).toBe(30000)
  })

  it('no incluye deudas nacidas antes ni después del periodo', () => {
    const deudas = [
      deuda('antes', '2026-10-30', 40000),
      deuda('dentro', '2026-11-04', 10000),
      deuda('despues', '2026-11-09', 25000),
    ]
    expect(totalDeudasPendientes(deudas, [], desde, hasta)).toBe(10000)
  })

  it('incluye una deuda que se pagó después de la fecha de cierre', () => {
    const deudas = [deuda('d1', '2026-11-05', 50000)]
    const abonos = [abono('d1', '2026-11-10', 50000)]
    expect(totalDeudasPendientes(deudas, abonos, desde, hasta)).toBe(50000)
  })

  it('los días de los extremos del periodo cuentan', () => {
    const deudas = [
      deuda('primero', '2026-11-02', 10000),
      deuda('ultimo', '2026-11-08', 20000),
    ]
    expect(totalDeudasPendientes(deudas, [], desde, hasta)).toBe(30000)
  })

  it('un periodo de un solo día sirve para el cierre diario', () => {
    const deudas = [
      deuda('hoy', '2026-11-03', 15000),
      deuda('ayer', '2026-11-02', 99000),
    ]
    expect(
      totalDeudasPendientes(deudas, [], '2026-11-03', '2026-11-03'),
    ).toBe(15000)
  })

  it('rechaza un periodo donde el inicio es posterior al fin', () => {
    expect(() =>
      totalDeudasPendientes([], [], '2026-11-08', '2026-11-02'),
    ).toThrow()
  })
})