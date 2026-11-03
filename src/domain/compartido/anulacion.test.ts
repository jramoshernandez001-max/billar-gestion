/**
 * Pruebas del registro de anulación.
 *
 * Qué hace: verifica que anular un registro produzca una entrada de la
 * bitácora con la acción de anulación, el motivo, y el valor de antes y de
 * después.
 * Cómo lo hace: construye anulaciones con datos inventados y revisa el
 * resultado y las validaciones.
 * Por qué: nada se borra; la anulación es la forma de corregir un error, y
 * debe quedar claro quién lo hizo, cuándo y por qué.
 */
import { describe, it, expect } from 'vitest'
import { crearRegistroAnulacion } from './anulacion'

const momento = new Date('2026-03-10T14:00:00.000Z')
const venta = { id: 'v1', valor: 38000, anulada: false }
const ventaAnulada = { id: 'v1', valor: 38000, anulada: true }

describe('crearRegistroAnulacion', () => {
  it('arma el registro de anulación con motivo, antes y después', () => {
    expect(
      crearRegistroAnulacion({
        usuario: 'socio@example.com',
        momento,
        motivo: 'Se registró dos veces',
        antes: venta,
        despues: ventaAnulada,
      }),
    ).toEqual({
      usuario: 'socio@example.com',
      fechaHora: '2026-03-10T14:00:00.000Z',
      accion: 'anular-registro',
      motivo: 'Se registró dos veces',
      antes: venta,
      despues: ventaAnulada,
    })
  })

  it('quita los espacios sobrantes del motivo', () => {
    const registro = crearRegistroAnulacion({ usuario: 'a@example.com', momento, motivo: '  error de captura ', antes: venta, despues: ventaAnulada })
    expect(registro.motivo).toBe('error de captura')
  })

  it('rechaza un motivo vacío', () => {
    expect(() =>
      crearRegistroAnulacion({ usuario: 'a@example.com', momento, motivo: '   ', antes: venta, despues: ventaAnulada }),
    ).toThrow(/motivo/i)
  })

  it('rechaza anular sin valor de antes: solo se anula algo que ya existe', () => {
    expect(() =>
      crearRegistroAnulacion({ usuario: 'a@example.com', momento, motivo: 'error', antes: null as unknown as typeof venta, despues: ventaAnulada }),
    ).toThrow(/antes/i)
  })

  it('aplica las mismas validaciones de la bitácora', () => {
    expect(() =>
      crearRegistroAnulacion({ usuario: '', momento, motivo: 'error', antes: venta, despues: ventaAnulada }),
    ).toThrow(/usuario/i)
  })
})
