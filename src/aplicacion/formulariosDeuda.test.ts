/**
 * Pruebas de los formularios de deuda y de abono.
 *
 * Qué hace: verifica la validación de cliente, monto y descripción, y que un
 * abono no supere lo que se debe.
 * Cómo lo hace: entradas de texto como las escribe la persona.
 * Por qué: la base rechaza un abono de más; avisar antes evita el error.
 */
import { describe, it, expect } from 'vitest'
import { validarAbono, validarDeuda } from './formulariosDeuda'

describe('validarDeuda', () => {
  it('limpia y convierte una entrada válida', () => {
    expect(validarDeuda({ cliente: '  Ana  Ruiz ', monto: '15000', descripcion: ' Fiado   de   cervezas ' }, '2026-11-03')).toEqual({
      datos: { cliente: 'Ana Ruiz', fecha: '2026-11-03', monto: 15000, descripcion: 'Fiado de cervezas' },
      errores: {},
      puedeGuardar: true,
    })
  })

  it('exige cliente, monto mayor a cero y descripción', () => {
    const r = validarDeuda({ cliente: ' ', monto: '0', descripcion: '  ' }, '2026-11-03')
    expect(Object.keys(r.errores).sort()).toEqual(['cliente', 'descripcion', 'monto'])
    expect(r.puedeGuardar).toBe(false)
    expect(r.datos).toBeNull()
  })

  it('la descripción no pasa de 200 caracteres', () => {
    expect(validarDeuda({ cliente: 'Ana', monto: '1', descripcion: 'x'.repeat(201) }, '2026-11-03').errores.descripcion).toMatch(/200/)
  })
})

describe('validarAbono', () => {
  it('acepta un abono menor o igual al saldo', () => {
    expect(validarAbono({ monto: '5000', descripcion: 'Pagó en efectivo' }, 'd1', 15000, '2026-11-03')).toEqual({
      datos: { deudaId: 'd1', fecha: '2026-11-03', monto: 5000, descripcion: 'Pagó en efectivo' },
      errores: {},
      puedeGuardar: true,
    })
    expect(validarAbono({ monto: '15000', descripcion: 'Saldó' }, 'd1', 15000, '2026-11-03').puedeGuardar).toBe(true)
  })

  it('rechaza un abono que supera el saldo, diciendo cuánto se debe', () => {
    const r = validarAbono({ monto: '16000', descripcion: 'Pagó' }, 'd1', 15000, '2026-11-03')
    expect(r.errores.monto).toMatch(/supera/i)
    expect(r.errores.monto).toMatch(/15\.000/)
  })

  it('rechaza monto vacío o cero y descripción vacía', () => {
    const r = validarAbono({ monto: '', descripcion: '' }, 'd1', 15000, '2026-11-03')
    expect(r.errores.monto).toBeDefined()
    expect(r.errores.descripcion).toBeDefined()
  })
})
