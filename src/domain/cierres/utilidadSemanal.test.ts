/**
 * Pruebas de la utilidad semanal.
 *
 * Qué hace: verifica el costo de reponer lo vendido (con el costo de la última
 * compra de cada producto) y la utilidad esperada, la real y su diferencia.
 * Cómo lo hace: arma compras y ventas de ejemplo con números fáciles de
 * revisar a mano y compara el resultado de cada función con lo esperado.
 * Por qué: la utilidad semanal le dice al dueño cuánta plata debería quedar
 * después de reponer lo vendido, y cuánta quedó en realidad. Un error aquí
 * lleva a decidir con números falsos.
 */
import { describe, it, expect } from 'vitest'
import {
  calcularUtilidadSemanal,
  costoReposicion,
  costoReposicionTotal,
} from './utilidadSemanal'

// Última compra de Costeñita: una caja de 38 unidades por 100.000.
const ultimaCompraCostenita = { unidades: 38, costoTotal: 100000 }
// Última compra de Águila: una caja de 30 unidades por 90.000.
const ultimaCompraAguila = { unidades: 30, costoTotal: 90000 }

describe('costoReposicion', () => {
  it('vender una caja completa cuesta reponer lo que costó esa caja', () => {
    expect(costoReposicion(38, ultimaCompraCostenita)).toBe(100000)
  })

  it('redondea al peso cuando el costo por unidad no es exacto', () => {
    // 10 x 100.000 / 38 = 26.315,78... que se redondea a 26.316.
    expect(costoReposicion(10, ultimaCompraCostenita)).toBe(26316)
  })

  it('sirve también cuando la última compra fue por unidades sueltas', () => {
    // 5 unidades compradas por 14.000: cada una costó 2.800.
    expect(costoReposicion(5, { unidades: 5, costoTotal: 14000 })).toBe(14000)
    expect(costoReposicion(2, { unidades: 5, costoTotal: 14000 })).toBe(5600)
  })

  it('no vender nada no cuesta nada', () => {
    expect(costoReposicion(0, ultimaCompraCostenita)).toBe(0)
  })

  it('rechaza unidades vendidas negativas o con decimales', () => {
    expect(() => costoReposicion(-1, ultimaCompraCostenita)).toThrow()
    expect(() => costoReposicion(1.5, ultimaCompraCostenita)).toThrow()
  })

  it('rechaza una compra de referencia inválida', () => {
    expect(() => costoReposicion(1, { unidades: 0, costoTotal: 1000 })).toThrow()
    expect(() => costoReposicion(1, { unidades: 38, costoTotal: -1 })).toThrow()
    expect(() => costoReposicion(1, { unidades: 38, costoTotal: 99.5 })).toThrow()
  })
})

describe('costoReposicionTotal', () => {
  it('sin ventas el costo es cero', () => {
    expect(costoReposicionTotal([])).toBe(0)
  })

  it('suma el costo de reposición de cada producto', () => {
    // Costeñita: 10 unidades = 26.316. Águila: 3 unidades = 9.000.
    const lineas = [
      { unidadesVendidas: 10, ultimaCompra: ultimaCompraCostenita },
      { unidadesVendidas: 3, ultimaCompra: ultimaCompraAguila },
    ]
    expect(costoReposicionTotal(lineas)).toBe(35316)
  })
})

describe('calcularUtilidadSemanal', () => {
  it('calcula la utilidad esperada, la real y la diferencia', () => {
    // Vendiste 2.000.000, reponer cuesta 1.700.000 y tienes 1.950.000.
    expect(
      calcularUtilidadSemanal({
        valorVentas: 2000000,
        costoReposicion: 1700000,
        dineroTotal: 1950000,
      }),
    ).toEqual({
      utilidadEsperada: 300000,
      utilidadReal: 250000,
      diferencia: -50000,
    })
  })

  it('cuando el dinero iguala a las ventas, la real es igual a la esperada', () => {
    expect(
      calcularUtilidadSemanal({
        valorVentas: 1000000,
        costoReposicion: 800000,
        dineroTotal: 1000000,
      }),
    ).toEqual({
      utilidadEsperada: 200000,
      utilidadReal: 200000,
      diferencia: 0,
    })
  })

  it('cuando sobra dinero, la diferencia es positiva', () => {
    expect(
      calcularUtilidadSemanal({
        valorVentas: 1000000,
        costoReposicion: 800000,
        dineroTotal: 1020000,
      }),
    ).toEqual({
      utilidadEsperada: 200000,
      utilidadReal: 220000,
      diferencia: 20000,
    })
  })

  it('permite una utilidad negativa si se vendió por debajo del costo', () => {
    const resultado = calcularUtilidadSemanal({
      valorVentas: 500000,
      costoReposicion: 600000,
      dineroTotal: 500000,
    })
    expect(resultado.utilidadEsperada).toBe(-100000)
    expect(resultado.utilidadReal).toBe(-100000)
  })

  it('rechaza montos negativos o con decimales', () => {
    const base = { valorVentas: 1000, costoReposicion: 500, dineroTotal: 1000 }
    expect(() => calcularUtilidadSemanal({ ...base, valorVentas: -1 })).toThrow()
    expect(() =>
      calcularUtilidadSemanal({ ...base, costoReposicion: 10.5 }),
    ).toThrow()
    expect(() => calcularUtilidadSemanal({ ...base, dineroTotal: -5 })).toThrow()
  })
})