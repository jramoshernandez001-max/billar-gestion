/**
 * Pruebas de la sincronización automática.
 *
 * Qué hace: verifica que se sincronice al abrir, al volver internet y cada
 * cierto tiempo mientras haya pendientes, y que se pueda detener.
 * Cómo lo hace: servicio falso, un EventTarget como ventana y reloj simulado.
 * Por qué: nadie debe acordarse de pulsar "enviar": al volver la señal, lo
 * pendiente sale solo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { iniciarSincronizacionAutomatica } from './sincronizacionAutomatica'

afterEach(() => vi.useRealTimers())

const falso = (pendientes: number) => ({
  sincronizar: vi.fn().mockResolvedValue(undefined),
  estado: () => ({ pendientes, rechazadas: [], sincronizando: false }),
})

describe('iniciarSincronizacionAutomatica', () => {
  it('sincroniza al iniciar', () => {
    const s = falso(0)
    iniciarSincronizacionAutomatica(s, new EventTarget(), 1000)
    expect(s.sincronizar).toHaveBeenCalledTimes(1)
  })

  it('sincroniza cuando vuelve la conexión', () => {
    const s = falso(0)
    const ventana = new EventTarget()
    iniciarSincronizacionAutomatica(s, ventana, 1000)
    ventana.dispatchEvent(new Event('online'))
    expect(s.sincronizar).toHaveBeenCalledTimes(2)
  })

  it('reintenta cada intervalo solo si hay pendientes', () => {
    vi.useFakeTimers()
    const con = falso(2)
    iniciarSincronizacionAutomatica(con, new EventTarget(), 1000)
    vi.advanceTimersByTime(3000)
    expect(con.sincronizar).toHaveBeenCalledTimes(4)
    const sin = falso(0)
    iniciarSincronizacionAutomatica(sin, new EventTarget(), 1000)
    vi.advanceTimersByTime(3000)
    expect(sin.sincronizar).toHaveBeenCalledTimes(1)
  })

  it('al detener deja de reaccionar', () => {
    vi.useFakeTimers()
    const s = falso(1)
    const ventana = new EventTarget()
    const detener = iniciarSincronizacionAutomatica(s, ventana, 1000)
    detener()
    ventana.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(5000)
    expect(s.sincronizar).toHaveBeenCalledTimes(1)
  })
})
