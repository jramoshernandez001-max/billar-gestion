/**
 * Pruebas de la bitácora de auditoría.
 *
 * Qué hace: verifica que se construya un registro con quién hizo el cambio,
 * cuándo, qué acción fue (de una lista fija), y el valor antes y después.
 * Cómo lo hace: construye registros con datos inventados y revisa el
 * resultado, las validaciones y que el registro no cambie si después se
 * modifica el objeto original.
 * Por qué: los dos usuarios tienen los mismos permisos; la bitácora es la
 * única forma de saber quién cambió qué y cuándo.
 */
import { describe, it, expect } from 'vitest'
import { ACCIONES_BITACORA, crearRegistroBitacora, type AccionBitacora } from './bitacora'

const momento = new Date('2026-03-07T23:15:30.000Z')

describe('crearRegistroBitacora', () => {
  it('arma el registro con usuario, fecha y hora, acción, antes y después', () => {
    expect(
      crearRegistroBitacora({
        usuario: 'persona@example.com',
        momento,
        accion: 'cambiar-precio',
        antes: { precioCaja: 40000 },
        despues: { precioCaja: 42000 },
      }),
    ).toEqual({
      usuario: 'persona@example.com',
      fechaHora: '2026-03-07T23:15:30.000Z',
      accion: 'cambiar-precio',
      antes: { precioCaja: 40000 },
      despues: { precioCaja: 42000 },
    })
  })

  it('permite antes nulo cuando el registro es de algo nuevo', () => {
    const creado = crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'registrar-deuda', antes: null, despues: { monto: 5000 } })
    expect(creado.antes).toBeNull()
  })

  it('rechaza después nulo: nada se borra, todo cambio deja un valor después', () => {
    expect(() =>
      crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'anular-registro', antes: { monto: 5000 }, despues: null as unknown as object }),
    ).toThrow(/después/i)
  })

  it('el registro no cambia si después se modifica el objeto original', () => {
    const valor = { precioCaja: 40000 }
    const despues = { precioCaja: 42000 }
    const registro = crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: 'cambiar-precio', antes: valor, despues })
    valor.precioCaja = 1
    despues.precioCaja = 1
    expect(registro.antes).toEqual({ precioCaja: 40000 })
    expect(registro.despues).toEqual({ precioCaja: 42000 })
  })

  it('quita los espacios sobrantes del usuario', () => {
    const registro = crearRegistroBitacora({ usuario: '  a@example.com ', momento, accion: 'editar-producto', antes: null, despues: {} })
    expect(registro.usuario).toBe('a@example.com')
  })

  it('rechaza usuario o acción vacíos', () => {
    expect(() => crearRegistroBitacora({ usuario: '  ', momento, accion: 'editar-producto', antes: null, despues: {} })).toThrow(/usuario/i)
    expect(() => crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: '' as AccionBitacora, antes: null, despues: {} })).toThrow(/acción/i)
  })

  it('rechaza una acción que no está en la lista fija', () => {
    // Puede llegar de afuera (base de datos, versión vieja de la app), por eso
    // se revisa también cuando el programa corre, no solo al compilar.
    for (const accion of ['borrar-venta', 'Registrar-compra', ' registrar-compra ']) {
      expect(() =>
        crearRegistroBitacora({ usuario: 'a@example.com', momento, accion: accion as AccionBitacora, antes: null, despues: {} }),
      ).toThrow(/acción/i)
    }
  })

  it('acepta todas las acciones de la lista', () => {
    for (const accion of ACCIONES_BITACORA) {
      expect(crearRegistroBitacora({ usuario: 'a@example.com', momento, accion, antes: null, despues: {} }).accion).toBe(accion)
    }
  })

  it('la lista cubre todo lo que cambia datos', () => {
    expect([...ACCIONES_BITACORA].sort()).toEqual(
      [
        'registrar-compra',
        'corregir-costo-compra',
        'registrar-traslado',
        'registrar-ajuste',
        'registrar-venta',
        'registrar-cierre-diario',
        'registrar-cierre-semanal',
        'registrar-deuda',
        'registrar-abono',
        'cambiar-precio',
        'crear-producto',
        'editar-producto',
        'anular-registro',
        'recalcular-cierre-diario',
        'recalcular-cierre-semanal',
      ].sort(),
    )
  })

  it('rechaza una fecha y hora inválida', () => {
    expect(() =>
      crearRegistroBitacora({ usuario: 'a@example.com', momento: new Date('no es fecha'), accion: 'editar-producto', antes: null, despues: {} }),
    ).toThrow(/fecha/i)
  })
})
