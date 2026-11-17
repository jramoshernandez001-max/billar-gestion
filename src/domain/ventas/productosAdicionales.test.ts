/**
 * Pruebas de los productos adicionales ("Otros") de una venta.
 *
 * Qué hace: verifica la validación de un producto adicional, la suma de su
 * valor y que solo cuenten los de ventas vigentes.
 * Cómo lo hace: arma productos y ventas de ejemplo inventados.
 * Por qué: estos productos no están en el inventario, pero su plata sí está
 * en la caja al final del día; si se suman mal, el cierre no cuadra.
 */
import { describe, it, expect } from 'vitest'
import {
  adicionalesVigentes,
  normalizarAdicional,
  validarAdicional,
  valorAdicionales,
  type ProductoAdicional,
} from './productosAdicionales'
import type { Venta } from './venta'

const hidratante: ProductoAdicional = { descripcion: 'Hidratante', cantidad: 5, valor: 25000 }
const mani: ProductoAdicional = { descripcion: 'Maní', cantidad: 2, valor: 4000 }

const venta = (id: string, estado: Venta['estado'], adicionales?: ProductoAdicional[]): Venta => ({
  id,
  fecha: '2026-03-12',
  estado,
  renglones: [],
  ...(adicionales === undefined ? {} : { adicionales }),
})

describe('validarAdicional', () => {
  it('acepta un producto con nombre, cantidad y valor', () => {
    expect(() => validarAdicional(hidratante)).not.toThrow()
  })

  it('exige un nombre', () => {
    expect(() => validarAdicional({ ...hidratante, descripcion: '' })).toThrow(/nombre/i)
  })

  it('exige una cantidad entera mayor a cero', () => {
    expect(() => validarAdicional({ ...hidratante, cantidad: 0 })).toThrow(/cantidad/i)
    expect(() => validarAdicional({ ...hidratante, cantidad: 1.5 })).toThrow(/cantidad/i)
  })

  it('exige un valor entero mayor a cero', () => {
    expect(() => validarAdicional({ ...hidratante, valor: 0 })).toThrow(/valor/i)
    expect(() => validarAdicional({ ...hidratante, valor: -100 })).toThrow(/valor/i)
    expect(() => validarAdicional({ ...hidratante, valor: 100.5 })).toThrow(/valor/i)
  })
})

describe('normalizarAdicional', () => {
  it('limpia los espacios sobrantes del nombre', () => {
    expect(normalizarAdicional({ ...hidratante, descripcion: '  Hidratante   azul ' }).descripcion).toBe('Hidratante azul')
  })

  it('valida el resto', () => {
    expect(() => normalizarAdicional({ ...hidratante, valor: 0 })).toThrow(/valor/i)
  })
})

describe('valorAdicionales', () => {
  it('suma el valor de cada producto (el valor ya es el total del renglón)', () => {
    expect(valorAdicionales([hidratante, mani])).toBe(29000)
  })

  it('sin productos es cero', () => {
    expect(valorAdicionales([])).toBe(0)
  })
})

describe('adicionalesVigentes', () => {
  it('junta los adicionales de las ventas vigentes y deja por fuera los de las anuladas', () => {
    expect(adicionalesVigentes([venta('v1', 'vigente', [hidratante]), venta('v2', 'anulada', [mani])])).toEqual([hidratante])
  })

  it('una venta sin adicionales no aporta nada', () => {
    expect(adicionalesVigentes([venta('v1', 'vigente')])).toEqual([])
  })
})
