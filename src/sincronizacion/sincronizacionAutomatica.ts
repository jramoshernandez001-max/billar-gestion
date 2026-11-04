/**
 * Sincronización automática.
 *
 * Qué hace: manda lo pendiente al abrir la app, cuando el navegador avisa
 * que volvió internet y cada cierto tiempo mientras quede algo pendiente.
 * Cómo lo hace: llama a `sincronizar` en cada uno de esos momentos y devuelve
 * una función que lo detiene todo.
 * Por qué: nadie debe acordarse de enviar; el evento `online` a veces tarda o
 * no llega, por eso también se reintenta con un temporizador.
 */
import type { ServicioSincronizacion } from './servicioSincronizacion'

export function iniciarSincronizacionAutomatica(
  servicio: Pick<ServicioSincronizacion, 'sincronizar' | 'estado'>,
  ventana: EventTarget,
  intervaloMs = 30_000,
): () => void {
  const lanzar = (): void => void servicio.sincronizar()
  lanzar()
  ventana.addEventListener('online', lanzar)
  const temporizador = setInterval(() => {
    if (servicio.estado().pendientes > 0) lanzar()
  }, intervaloMs)
  return () => {
    ventana.removeEventListener('online', lanzar)
    clearInterval(temporizador)
  }
}
