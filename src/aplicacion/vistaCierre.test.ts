/**
 * Pruebas de la vista de un cierre.
 *
 * Qué hace: verifica que un resultado guardado (diario o semanal, completo o
 * incompleto) se convierta en lo que muestra la pantalla: vendido, dinero,
 * cuadre y utilidad.
 * Cómo lo hace: resultados con números hechos a mano.
 * Por qué: el resultado se guarda como datos sueltos; la pantalla no debe
 * interpretarlos ni calcular nada.
 */
import { describe, it, expect } from 'vitest'
import { describirCierre } from './vistaCierre'

const nombres = new Map([['p1', 'Cerveza Ejemplo'], ['p2', 'Agua Ejemplo']])

const diario = (diferencia: number) => {
  const dineroTotal = 60000
  return { dineroTotal, diferencia, cuadra: diferencia >= 0, faltante: diferencia < 0 ? -diferencia : 0, sobrante: diferencia > 0 ? diferencia : 0 }
}

describe('describirCierre (diario)', () => {
  it('cuadra exacto', () => {
    expect(describirCierre('diario', diario(0), { efectivo: 40000, transferencias: 10000 }, nombres)).toMatchObject({
      vendido: 60000, dineroTotal: 60000, deudas: 10000, estado: 'cuadra', monto: 0, semanal: null,
    })
  })

  it('con faltante', () => {
    expect(describirCierre('diario', diario(-5000), { efectivo: 40000, transferencias: 10000 }, nombres)).toMatchObject({
      vendido: 65000, estado: 'faltante', monto: 5000,
    })
  })

  it('con sobrante', () => {
    expect(describirCierre('diario', diario(3000), { efectivo: 40000, transferencias: 10000 }, nombres)).toMatchObject({
      vendido: 57000, estado: 'sobrante', monto: 3000,
    })
  })
})

describe('describirCierre (semanal)', () => {
  const cuadre = diario(-2000)
  const base = { costoReposicion: 30000, comprasUsadas: ['c1', 'c2'], costosUsados: [{ productoId: 'p1', compra: { id: 'c1', fecha: '2026-10-30' } }], cuadre }

  it('completo trae utilidad esperada, real y diferencia', () => {
    const r = describirCierre('semanal', { ...base, completo: true, productosSinCosto: [], ventasSinCosto: 0, utilidad: { utilidadEsperada: 35000, utilidadReal: 33000, diferencia: -2000 } }, { efectivo: 40000, transferencias: 10000 }, nombres)
    expect(r.estado).toBe('faltante')
    expect(r.semanal).toEqual({
      completo: true,
      costoReposicion: 30000,
      utilidadEsperada: 35000,
      utilidadReal: 33000,
      diferenciaUtilidad: -2000,
      ventasSinCosto: 0,
      productosSinCosto: [],
      comprasUsadas: 2,
    })
  })

  it('incompleto no trae utilidad real y lista los productos sin costo con su nombre', () => {
    const r = describirCierre('semanal', { ...base, completo: false, utilidadEsperada: 20000, productosSinCosto: ['p2', 'p9'], ventasSinCosto: 12000 }, { efectivo: 40000, transferencias: 10000 }, nombres)
    expect(r.semanal).toMatchObject({
      completo: false,
      utilidadEsperada: 20000,
      utilidadReal: null,
      diferenciaUtilidad: null,
      ventasSinCosto: 12000,
      productosSinCosto: [{ id: 'p2', nombre: 'Agua Ejemplo' }, { id: 'p9', nombre: 'Producto' }],
    })
  })

  it('un resultado con otra forma es un error claro', () => {
    expect(() => describirCierre('semanal', { cualquier: 'cosa' }, { efectivo: 0, transferencias: 0 }, nombres)).toThrow(/resultado/i)
    expect(() => describirCierre('diario', null, { efectivo: 0, transferencias: 0 }, nombres)).toThrow(/resultado/i)
  })
})
