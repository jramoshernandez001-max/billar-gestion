/**
 * Pruebas de los ajustes de inventario por conteo físico.
 *
 * Qué hace: verifica que un ajuste produzca su movimiento (producto,
 * ubicación, unidades con signo) y su registro de bitácora con el motivo.
 * Cómo lo hace: arma ajustes de ejemplo inventados, revisa el movimiento,
 * el registro, el efecto en el stock y las validaciones.
 * Por qué: el conteo físico puede no coincidir con la suma de movimientos;
 * el ajuste lo corrige sin editar el stock y deja constancia de por qué.
 */
import { describe, it, expect } from 'vitest'
import { crearAjuste, type DatosAjuste } from './ajustes'
import { calcularStock, type Movimiento } from './stock'

const momento = new Date('2026-03-15T22:00:00.000Z')

/** Datos de ejemplo: faltan 2 unidades en la nevera. */
const datos = (cambios: Partial<DatosAjuste> = {}): DatosAjuste => ({
  productoId: 'cerveza-a',
  ubicacion: 'nevera',
  unidades: -2,
  motivo: 'Conteo del domingo: faltan 2',
  usuario: 'a@example.com',
  momento,
  ...cambios,
})

describe('crearAjuste', () => {
  it('produce el movimiento de ajuste con signo', () => {
    expect(crearAjuste(datos()).movimiento).toEqual({
      productoId: 'cerveza-a',
      tipo: 'ajuste',
      ubicacion: 'nevera',
      unidades: -2,
    })
  })

  it('un ajuste positivo suma en la ubicación', () => {
    const inicial: Movimiento = { productoId: 'cerveza-a', tipo: 'compra', ubicacion: 'bodega', unidades: 10 }
    const { movimiento } = crearAjuste(datos({ ubicacion: 'bodega', unidades: 3, motivo: 'Sobran 3' }))
    expect(calcularStock([inicial, movimiento], 'cerveza-a').bodega).toBe(13)
  })

  it('arma el registro de bitácora con la acción de ajuste y el motivo', () => {
    expect(crearAjuste(datos()).registro).toEqual({
      usuario: 'a@example.com',
      fechaHora: '2026-03-15T22:00:00.000Z',
      accion: 'registrar-ajuste',
      antes: null,
      despues: {
        productoId: 'cerveza-a',
        ubicacion: 'nevera',
        unidades: -2,
        motivo: 'Conteo del domingo: faltan 2',
      },
    })
  })

  it('quita los espacios sobrantes del motivo', () => {
    expect(crearAjuste(datos({ motivo: '  faltan 2 ' })).registro.despues.motivo).toBe('faltan 2')
  })

  it('rechaza un motivo vacío', () => {
    expect(() => crearAjuste(datos({ motivo: '   ' }))).toThrow(/motivo/i)
  })

  it('rechaza cero unidades o unidades que no son enteras', () => {
    expect(() => crearAjuste(datos({ unidades: 0 }))).toThrow(/unidades/i)
    expect(() => crearAjuste(datos({ unidades: 1.5 }))).toThrow(/unidades/i)
  })
})
