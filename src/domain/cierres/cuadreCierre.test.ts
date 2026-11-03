/**
 * Pruebas del cuadre de un cierre (diario o semanal).
 *
 * Qué hace: verifica que el dinero disponible (efectivo + transferencias +
 * deudas) se compare con el valor de la venta y que se calcule el faltante o
 * el sobrante.
 * Cómo lo hace: arma cierres de ejemplo que cuadran justo, que sobran y que
 * faltan, y compara el resultado de cuadrarCierre con lo esperado a mano.
 * Por qué: el cierre existe para detectar si falta plata; un error en este
 * cálculo ocultaría un faltante real o inventaría uno falso.
 */
import { describe, it, expect } from 'vitest'
import { cuadrarCierre } from './cuadreCierre'

describe('cuadrarCierre', () => {
  it('cuadra justo cuando el dinero es igual a la venta', () => {
    expect(
      cuadrarCierre({
        valorVentas: 262500,
        efectivo: 150000,
        transferencias: 80000,
        deudas: 32500,
      }),
    ).toEqual({
      dineroTotal: 262500,
      diferencia: 0,
      cuadra: true,
      faltante: 0,
      sobrante: 0,
    })
  })

  it('cuadra y muestra el sobrante cuando hay más dinero que venta', () => {
    expect(
      cuadrarCierre({
        valorVentas: 100000,
        efectivo: 100000,
        transferencias: 5000,
        deudas: 0,
      }),
    ).toEqual({
      dineroTotal: 105000,
      diferencia: 5000,
      cuadra: true,
      faltante: 0,
      sobrante: 5000,
    })
  })

  it('no cuadra y calcula el faltante cuando hay menos dinero que venta', () => {
    expect(
      cuadrarCierre({
        valorVentas: 100000,
        efectivo: 60000,
        transferencias: 30000,
        deudas: 0,
      }),
    ).toEqual({
      dineroTotal: 90000,
      diferencia: -10000,
      cuadra: false,
      faltante: 10000,
      sobrante: 0,
    })
  })

  it('las deudas cuentan como dinero para cuadrar', () => {
    const resultado = cuadrarCierre({
      valorVentas: 50000,
      efectivo: 20000,
      transferencias: 0,
      deudas: 30000,
    })
    expect(resultado.cuadra).toBe(true)
    expect(resultado.faltante).toBe(0)
  })

  it('un cierre sin ventas ni dinero cuadra en cero', () => {
    expect(
      cuadrarCierre({
        valorVentas: 0,
        efectivo: 0,
        transferencias: 0,
        deudas: 0,
      }),
    ).toEqual({
      dineroTotal: 0,
      diferencia: 0,
      cuadra: true,
      faltante: 0,
      sobrante: 0,
    })
  })

  it('rechaza montos negativos o con decimales', () => {
    const base = {
      valorVentas: 1000,
      efectivo: 1000,
      transferencias: 0,
      deudas: 0,
    }
    expect(() => cuadrarCierre({ ...base, valorVentas: -1 })).toThrow()
    expect(() => cuadrarCierre({ ...base, efectivo: 10.5 })).toThrow()
    expect(() => cuadrarCierre({ ...base, transferencias: -5 })).toThrow()
    expect(() => cuadrarCierre({ ...base, deudas: 0.5 })).toThrow()
  })
})