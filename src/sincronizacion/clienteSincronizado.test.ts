/**
 * Pruebas del cliente de datos con modo sin conexión.
 *
 * Qué hace: verifica que las escrituras permitidas pasen por la cola, que las
 * demás exijan conexión, y que las lecturas usen la última copia guardada
 * cuando no hay red.
 * Cómo lo hace: cliente base falso, servicio falso y almacén en memoria.
 * Por qué: es el punto donde la app decide entre "enviar ya", "guardar para
 * después" y "negar"; un error aquí duplica o pierde ventas.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ClienteDatos } from '../datos/clienteDatos'
import { crearClienteSincronizado, type AlmacenConClaves } from './clienteSincronizado'
import type { ServicioSincronizacion } from './servicioSincronizacion'

function almacen(): AlmacenConClaves {
  const m = new Map<string, string>()
  return {
    leer: (k) => m.get(k) ?? null,
    guardar: (k, v) => void m.set(k, v),
    borrar: (k) => void m.delete(k),
    claves: () => [...m.keys()],
  }
}

function base(partes: Partial<ClienteDatos> = {}): ClienteDatos {
  return {
    rpc: vi.fn().mockResolvedValue({ data: 'directo', error: null }),
    from: () => ({ select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }) }),
    ...partes,
  }
}

const servicio = (ejecutar: ServicioSincronizacion['ejecutar']): Pick<ServicioSincronizacion, 'ejecutar'> => ({ ejecutar })

describe('escrituras', () => {
  it('una operación permitida pasa por el servicio y devuelve su resultado', async () => {
    const ejecutar = vi.fn().mockResolvedValue({ tipo: 'aplicada', data: 'venta-1' })
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(ejecutar), almacen: almacen(), estaEnLinea: () => true })
    const r = await cliente.rpc('registrar_venta', { p_fecha: '2026-11-04' })
    expect(ejecutar).toHaveBeenCalledWith('registrar_venta', { p_fecha: '2026-11-04' })
    expect(r).toEqual({ data: 'venta-1', error: null })
  })

  it('si queda pendiente, devuelve un id que empieza con "pendiente:"', async () => {
    const ejecutar = vi.fn().mockResolvedValue({ tipo: 'pendiente', clave: 'abc' })
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(ejecutar), almacen: almacen(), estaEnLinea: () => false })
    expect(await cliente.rpc('registrar_compra', {})).toEqual({ data: 'pendiente:abc', error: null })
  })

  it('si la base la rechaza, devuelve el error', async () => {
    const ejecutar = vi.fn().mockResolvedValue({ tipo: 'rechazada', error: 'Cantidad inválida' })
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(ejecutar), almacen: almacen(), estaEnLinea: () => true })
    expect(await cliente.rpc('registrar_venta', {})).toEqual({ data: null, error: { message: 'Cantidad inválida' } })
  })

  it('una operación que no se puede hacer sin conexión falla de inmediato si no hay red', async () => {
    const crudo = base()
    const cliente = crearClienteSincronizado({ cliente: crudo, servicio: servicio(vi.fn()), almacen: almacen(), estaEnLinea: () => false })
    const r = await cliente.rpc('anular_venta', { p_venta_id: 'x' })
    expect(r.error?.message).toMatch(/necesita conexión/i)
    expect(crudo.rpc).not.toHaveBeenCalled()
  })

  it('con red, esa operación va directo a la base', async () => {
    const crudo = base()
    const cliente = crearClienteSincronizado({ cliente: crudo, servicio: servicio(vi.fn()), almacen: almacen(), estaEnLinea: () => true })
    expect(await cliente.rpc('anular_venta', { p_venta_id: 'x' })).toEqual({ data: 'directo', error: null })
    expect(crudo.rpc).toHaveBeenCalledWith('anular_venta', { p_venta_id: 'x' })
  })

  it('si la red falla en esa operación, el mensaje explica que necesita conexión', async () => {
    const crudo = base({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } }) })
    const cliente = crearClienteSincronizado({ cliente: crudo, servicio: servicio(vi.fn()), almacen: almacen(), estaEnLinea: () => true })
    expect((await cliente.rpc('anular_venta', {})).error?.message).toMatch(/necesita conexión/i)
  })

  it('un error normal de la base pasa tal cual', async () => {
    const crudo = base({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'No autorizado', code: 'P0001' } }) })
    const cliente = crearClienteSincronizado({ cliente: crudo, servicio: servicio(vi.fn()), almacen: almacen(), estaEnLinea: () => true })
    expect((await cliente.rpc('anular_venta', {})).error?.message).toBe('No autorizado')
  })
})

describe('lecturas', () => {
  it('con red devuelve las filas y guarda una copia', async () => {
    const a = almacen()
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true })
    expect(await cliente.from('productos').select('id')).toEqual({ data: [{ id: 1 }], error: null })
    expect(a.claves().length).toBe(1)
  })

  it('sin red devuelve la última copia guardada', async () => {
    const a = almacen()
    const bueno = crearClienteSincronizado({ cliente: base(), servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true })
    await bueno.from('productos').select('id')
    const caido = base({ from: () => ({ select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } }) }) })
    const cliente = crearClienteSincronizado({ cliente: caido, servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => false })
    expect(await cliente.from('productos').select('id')).toEqual({ data: [{ id: 1 }], error: null })
  })

  it('sin red y sin copia devuelve el error de red', async () => {
    const caido = base({ from: () => ({ select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } }) }) })
    const cliente = crearClienteSincronizado({ cliente: caido, servicio: servicio(vi.fn()), almacen: almacen(), estaEnLinea: () => false })
    const r = await cliente.from('productos').select('id')
    expect(r.error?.message).toMatch(/sin conexión/i)
  })

  it('un error de la base (no de red) no usa la copia', async () => {
    const a = almacen()
    await crearClienteSincronizado({ cliente: base(), servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true }).from('productos').select('id')
    const malo = base({ from: () => ({ select: vi.fn().mockResolvedValue({ data: null, error: { message: 'permiso denegado', code: '42501' } }) }) })
    const r = await crearClienteSincronizado({ cliente: malo, servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true }).from('productos').select('id')
    expect(r.error?.message).toBe('permiso denegado')
  })

  it('si guardar la copia falla, la lectura sigue funcionando', async () => {
    const a = almacen()
    a.guardar = () => {
      throw new Error('cuota')
    }
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true })
    expect((await cliente.from('productos').select('id')).data).toEqual([{ id: 1 }])
  })

  it('limpiarCache borra solo las copias de lecturas', async () => {
    const a = almacen()
    a.guardar('billar.pendientes', '[]')
    const cliente = crearClienteSincronizado({ cliente: base(), servicio: servicio(vi.fn()), almacen: a, estaEnLinea: () => true })
    await cliente.from('productos').select('id')
    cliente.limpiarCache()
    expect(a.claves()).toEqual(['billar.pendientes'])
  })
})
