/**
 * Pruebas de la cola de operaciones pendientes.
 *
 * Qué hace: verifica agregar, listar, quitar, marcar rechazada y reintentar,
 * y que un almacenamiento dañado no rompa la app.
 * Cómo lo hace: usa un almacén en memoria y claves de prueba predecibles.
 * Por qué: la cola guarda ventas que todavía no están en la base; perder o
 * duplicar una sería un error de dinero.
 */
import { describe, expect, it } from 'vitest'
import { crearCola, type AlmacenTexto } from './colaPendientes'

function almacenEnMemoria(): AlmacenTexto & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return {
    datos,
    leer: (k) => datos.get(k) ?? null,
    guardar: (k, v) => void datos.set(k, v),
    borrar: (k) => void datos.delete(k),
  }
}

const nueva = (almacen = almacenEnMemoria()) => {
  let n = 0
  return { almacen, cola: crearCola(almacen, () => `clave-${++n}`, () => '2026-11-04T06:00:00.000Z') }
}

describe('cola de pendientes', () => {
  it('empieza vacía', () => {
    expect(nueva().cola.listar()).toEqual([])
  })

  it('agrega una operación con clave, fecha y sin error', () => {
    const { cola } = nueva()
    const op = cola.agregar('registrar_venta', { p_fecha: '2026-11-04' })
    expect(op).toEqual({
      clave: 'clave-1',
      funcion: 'registrar_venta',
      argumentos: { p_fecha: '2026-11-04' },
      creadoEn: '2026-11-04T06:00:00.000Z',
      error: null,
    })
    expect(cola.listar()).toEqual([op])
  })

  it('conserva el orden y sobrevive a recrear la cola con el mismo almacén', () => {
    const { almacen, cola } = nueva()
    cola.agregar('registrar_venta', {})
    cola.agregar('registrar_compra', {})
    expect(crearCola(almacen).listar().map((o) => o.funcion)).toEqual(['registrar_venta', 'registrar_compra'])
  })

  it('rechaza una función que no se puede hacer sin conexión', () => {
    const { cola } = nueva()
    expect(() => cola.agregar('anular_venta', {})).toThrow(/sin conexión/i)
    expect(cola.listar()).toEqual([])
  })

  it('quita una operación por clave', () => {
    const { cola } = nueva()
    cola.agregar('registrar_venta', {})
    cola.agregar('registrar_compra', {})
    cola.quitar('clave-1')
    expect(cola.listar().map((o) => o.clave)).toEqual(['clave-2'])
  })

  it('marca una operación como rechazada con su error y permite reintentarla', () => {
    const { cola } = nueva()
    cola.agregar('registrar_abono', {})
    cola.marcarRechazada('clave-1', 'El abono supera la deuda')
    expect(cola.listar()[0].error).toBe('El abono supera la deuda')
    cola.reintentar('clave-1')
    expect(cola.listar()[0].error).toBeNull()
  })

  it('un almacén con texto dañado se ve como vacío', () => {
    const almacen = almacenEnMemoria()
    almacen.guardar('billar.pendientes', '{no es json')
    expect(crearCola(almacen).listar()).toEqual([])
  })

  it('ignora entradas con forma inválida pero conserva las buenas', () => {
    const almacen = almacenEnMemoria()
    almacen.guardar(
      'billar.pendientes',
      JSON.stringify([
        { clave: 'a', funcion: 'registrar_venta', argumentos: {}, creadoEn: '2026-11-04T00:00:00.000Z', error: null },
        { clave: 5 },
        'x',
      ]),
    )
    expect(crearCola(almacen).listar().map((o) => o.clave)).toEqual(['a'])
  })

  it('si no se puede guardar, agregar lanza un error claro y no deja nada', () => {
    const almacen = almacenEnMemoria()
    almacen.guardar = () => {
      throw new Error('cuota')
    }
    const cola = crearCola(almacen)
    expect(() => cola.agregar('registrar_venta', {})).toThrow(/no se pudo guardar en el teléfono/i)
  })
})
