/**
 * Pruebas de las conversiones entre presentaciones (unidad, sixpack, caja).
 *
 * Qué hace: verifica que cualquier cantidad vendida o comprada se convierta
 * correctamente a unidades, y que un total de unidades se pueda mostrar en
 * cajas completas más unidades sueltas.
 * Cómo lo hace: usa dos productos de ejemplo (uno sin sixpack y uno con sixpack)
 * y compara el resultado de cada función con el valor esperado.
 * Por qué: todo el inventario se guarda en unidades, así que un error aquí
 * descuadraría el stock, los cierres y la utilidad.
 */
import { describe, it, expect } from 'vitest'
import { aUnidades, descomponerEnCajas } from './conversiones'

// Cerveza en botella: caja x38 y sin sixpack.
const costenita = { unidadesPorCaja: 38, manejaSixpack: false }
// Cerveza que sí se maneja por sixpack: caja x24.
const coronita = { unidadesPorCaja: 24, manejaSixpack: true }

describe('aUnidades', () => {
  it('una unidad vale una unidad', () => {
    expect(aUnidades(costenita, 'unidad', 5)).toBe(5)
  })

  it('un sixpack vale seis unidades', () => {
    expect(aUnidades(coronita, 'sixpack', 2)).toBe(12)
  })

  it('una caja vale las unidades que trae esa cerveza', () => {
    expect(aUnidades(costenita, 'caja', 2)).toBe(76)
  })

  it('rechaza sixpack en un producto que no lo maneja', () => {
    expect(() => aUnidades(costenita, 'sixpack', 1)).toThrow(/sixpack/i)
  })

  it('rechaza cantidades negativas o con decimales', () => {
    expect(() => aUnidades(coronita, 'caja', -1)).toThrow()
    expect(() => aUnidades(coronita, 'caja', 1.5)).toThrow()
  })
})

describe('descomponerEnCajas', () => {
  it('separa cajas completas y unidades sueltas', () => {
    expect(descomponerEnCajas(66, 38)).toEqual({ cajas: 1, sueltas: 28 })
  })

  it('una caja exacta no deja unidades sueltas', () => {
    expect(descomponerEnCajas(30, 30)).toEqual({ cajas: 1, sueltas: 0 })
  })

  it('cero unidades da cero cajas', () => {
    expect(descomponerEnCajas(0, 24)).toEqual({ cajas: 0, sueltas: 0 })
  })
})