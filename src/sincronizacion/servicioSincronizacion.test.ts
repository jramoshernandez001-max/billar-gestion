/**
 * Pruebas del servicio de sincronización.
 *
 * Qué hace: verifica que las operaciones se apliquen al instante con
 * conexión, se guarden sin ella, se reenvíen en orden, no se dupliquen y
 * que un error de la base se separe de un fallo de red.
 * Cómo lo hace: cola en memoria y un "envío" falso que simula la base.
 * Por qué: es la pieza que decide qué se pierde, qué se reintenta y qué se
 * muestra como rechazado.
 */
import { describe, expect, it, vi } from 'vitest'
import { crearCola, type AlmacenTexto } from './colaPendientes'
import { crearServicioSincronizacion, type Envio } from './servicioSincronizacion'

function almacen(): AlmacenTexto {
  const m = new Map<string, string>()
  return { leer: (k) => m.get(k) ?? null, guardar: (k, v) => void m.set(k, v), borrar: (k) => void m.delete(k) }
}

function montar(envio: Envio, enLinea = true) {
  let n = 0
  const cola = crearCola(almacen(), () => `c${++n}`, () => '2026-11-04T06:00:00.000Z')
  const estado = { enLinea }
  const servicio = crearServicioSincronizacion({ cola, enviar: envio, estaEnLinea: () => estado.enLinea })
  return { cola, servicio, estado }
}

const ok = (data: unknown = 'id-1'): Envio => vi.fn().mockResolvedValue({ data, error: null })

describe('ejecutar', () => {
  it('con conexión aplica de inmediato y no deja nada pendiente', async () => {
    const envio = ok('venta-9')
    const { servicio, cola } = montar(envio)
    const r = await servicio.ejecutar('registrar_venta', { p_fecha: '2026-11-04' })
    expect(r).toEqual({ tipo: 'aplicada', data: 'venta-9' })
    expect(envio).toHaveBeenCalledWith('c1', 'registrar_venta', { p_fecha: '2026-11-04' })
    expect(cola.listar()).toEqual([])
  })

  it('sin conexión la guarda sin intentar enviar', async () => {
    const envio = ok()
    const { servicio, cola } = montar(envio, false)
    const r = await servicio.ejecutar('registrar_venta', {})
    expect(r).toEqual({ tipo: 'pendiente', clave: 'c1' })
    expect(envio).not.toHaveBeenCalled()
    expect(cola.listar()).toHaveLength(1)
    expect(servicio.estado().pendientes).toBe(1)
  })

  it('si la red falla a mitad, queda pendiente con la misma clave', async () => {
    const envio: Envio = vi.fn().mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    const { servicio, cola } = montar(envio)
    const r = await servicio.ejecutar('registrar_venta', {})
    expect(r).toEqual({ tipo: 'pendiente', clave: 'c1' })
    expect(cola.listar()[0].clave).toBe('c1')
  })

  it('si el envío lanza una excepción de red, queda pendiente', async () => {
    const envio: Envio = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const { servicio } = montar(envio)
    expect((await servicio.ejecutar('registrar_venta', {})).tipo).toBe('pendiente')
  })

  it('un error de la base se devuelve y no se guarda', async () => {
    const envio: Envio = vi.fn().mockResolvedValue({ data: null, error: { message: 'La venta no tiene nada', code: 'P0001' } })
    const { servicio, cola } = montar(envio)
    const r = await servicio.ejecutar('registrar_venta', {})
    expect(r).toEqual({ tipo: 'rechazada', error: 'La venta no tiene nada' })
    expect(cola.listar()).toEqual([])
  })
})

describe('sincronizar', () => {
  it('envía en orden y vacía la cola', async () => {
    const envio = ok()
    const { servicio, cola } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', { a: 1 })
    await servicio.ejecutar('registrar_compra', { b: 2 })
    await servicio.sincronizar(true)
    expect((envio as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1])).toEqual(['registrar_venta', 'registrar_compra'])
    expect(cola.listar()).toEqual([])
    expect(servicio.estado().pendientes).toBe(0)
  })

  it('si se cae la red, se detiene y conserva lo que falta', async () => {
    const envio: Envio = vi
      .fn()
      .mockResolvedValueOnce({ data: 'x', error: null })
      .mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const { servicio, cola } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', {})
    await servicio.ejecutar('registrar_compra', {})
    await servicio.ejecutar('registrar_deuda', {})
    await servicio.sincronizar(true)
    expect(cola.listar().map((o) => o.funcion)).toEqual(['registrar_compra', 'registrar_deuda'])
    expect(envio).toHaveBeenCalledTimes(2)
  })

  it('un error de la base marca esa operación como rechazada y sigue con las demás', async () => {
    const envio: Envio = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'El abono supera la deuda', code: 'P0001' } })
      .mockResolvedValue({ data: 'ok', error: null })
    const { servicio, cola } = montar(envio, false)
    await servicio.ejecutar('registrar_abono', {})
    await servicio.ejecutar('registrar_venta', {})
    await servicio.sincronizar(true)
    const resto = cola.listar()
    expect(resto).toHaveLength(1)
    expect(resto[0]).toMatchObject({ funcion: 'registrar_abono', error: 'El abono supera la deuda' })
    expect(servicio.estado()).toMatchObject({ pendientes: 0, rechazadas: [expect.objectContaining({ clave: 'c1' })] })
  })

  it('no vuelve a enviar las rechazadas', async () => {
    const envio: Envio = vi.fn().mockResolvedValue({ data: null, error: { message: 'mal', code: 'P0001' } })
    const { servicio } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', {})
    await servicio.sincronizar(true)
    await servicio.sincronizar(true)
    expect(envio).toHaveBeenCalledTimes(1)
  })

  it('sin conexión no intenta enviar', async () => {
    const envio = ok()
    const { servicio } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', {})
    await servicio.sincronizar()
    expect(envio).not.toHaveBeenCalled()
  })

  it('dos sincronizaciones a la vez no envían dos veces lo mismo', async () => {
    let liberar: () => void = () => {}
    const envio: Envio = vi.fn().mockImplementation(
      () => new Promise((resolver) => { liberar = () => resolver({ data: 'x', error: null }) }),
    )
    const { servicio } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', {})
    const a = servicio.sincronizar(true)
    const b = servicio.sincronizar(true)
    await Promise.resolve()
    liberar()
    await Promise.all([a, b])
    expect(envio).toHaveBeenCalledTimes(1)
  })

  it('reintentar una rechazada la devuelve a pendientes; descartar la quita', async () => {
    const envio: Envio = vi.fn().mockResolvedValue({ data: null, error: { message: 'mal', code: 'P0001' } })
    const { servicio, cola } = montar(envio, false)
    await servicio.ejecutar('registrar_venta', {})
    await servicio.sincronizar(true)
    servicio.reintentar('c1')
    expect(servicio.estado()).toMatchObject({ pendientes: 1, rechazadas: [] })
    await servicio.sincronizar(true)
    servicio.descartar('c1')
    expect(cola.listar()).toEqual([])
  })
})

describe('suscripción', () => {
  it('avisa cada cambio y deja de avisar al cancelar', async () => {
    const { servicio } = montar(ok(), false)
    const oyente = vi.fn()
    const cancelar = servicio.suscribir(oyente)
    await servicio.ejecutar('registrar_venta', {})
    expect(oyente).toHaveBeenCalled()
    const llamadas = oyente.mock.calls.length
    cancelar()
    await servicio.sincronizar(true)
    expect(oyente.mock.calls.length).toBe(llamadas)
  })

  it('estado() devuelve el mismo objeto mientras nada cambie (para useSyncExternalStore)', () => {
    const { servicio } = montar(ok())
    expect(servicio.estado()).toBe(servicio.estado())
  })
})
