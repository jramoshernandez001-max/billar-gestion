/**
 * Pruebas de la bitácora de auditoría.
 *
 * Qué hace: verifica que se construya un registro con quién hizo el cambio,
 * cuándo, qué acción fue, y el valor antes y después.
 * Cómo lo hace: construye registros con datos inventados y revisa el
 * resultado, las validaciones y que el registro no cambie si después se
 * modifica el objeto original.
 * Por qué: los dos usuarios tienen los mismos permisos; la bitácora es la
 * única forma de saber quién cambió qué y cuándo.
 */
import { describe, it, expect } from 'vitest'
import { crearRegistroBitacora } from './bitacora'

const momento = new Date('2026-03-07T23:15:30.000Z')

describe('crearRegistroBitacora', () => {
  it('arma el registro con usuario, fecha y hora, acción, antes y después', () => {
    expect(
      crearRegistroBitacora({
        usuario: 'persona@example.com',
        momento,
        accion: 'editar precio de caja',
        antes: { precioCaja: 40000 },
        despues: { precioCaja: 42000 },
      }),
    ).toEqual({
      usuario: 'persona@example.com',
      fechaHora: '2026-03-07T23:15:30.000Z',
      accion: 'editar precio de caja',
      antes: { precioCaja: 40000 },
      despues: { precioCaja: 42000 },
    })
  })

  it('permite antes nulo (algo nuevo) y después nulo (algo borrado)', () => {
    const creado = crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'crear deuda', antes: null, despues: { monto: 5000 } })
    const borrado = crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'borrar deuda', antes: { monto: 5000 }, despues: null })
    expect(creado.antes).toBeNull()
    expect(borrado.despues).toBeNull()
  })

  it('el registro no cambia si después se modifica el objeto original', () => {
    const valor = { precioCaja: 40000 }
    const registro = crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'editar', antes: valor, despues: null })
    valor.precioCaja = 1
    expect(registro.antes).toEqual({ precioCaja: 40000 })
  })

  it('quita los espacios sobrantes del usuario y la acción', () => {
    const registro = crearRegistroBitacora({ usuario: '  a@example.com ', momento, accion: ' editar ', antes: null, despues: null })
    expect(registro.usuario).toBe('a@example.com')
    expect(registro.accion).toBe('editar')
  })

  it('rechaza usuario o acción vacíos', () => {
    expect(() => crearRegistroBitacora({ usuario: '  ', momento, accion: 'editar', antes: null, despues: null })).toThrow(/usuario/i)
    expect(() => crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: '', antes: null, despues: null })).toThrow(/acción/i)
  })

  it('rechaza una fecha y hora inválida', () => {
    expect(() =>
      crearRegistroBitacora({ usuario: 'a@example.com', momento: new Date('no es fecha'), accion: 'editar', antes: null, despues: null }),
    ).toThrow(/fecha/i)
  })
})
