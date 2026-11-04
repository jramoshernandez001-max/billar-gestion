/**
 * Detección de fallos de conexión.
 *
 * Qué hace: dice si un error es un fallo de red (no hay internet o la
 * petición no llegó) y no una respuesta de la base de datos.
 * Cómo lo hace: un error de la base trae `code` (Postgres, ej. P0001); un
 * fallo de fetch no lo trae y su mensaje habla de "fetch" o "network".
 * También acepta la excepción TypeError que lanza fetch.
 * Por qué: un fallo de red se guarda y se reintenta al volver internet; un
 * error de la base ("el abono supera la deuda") se muestra a la persona y no
 * se reintenta porque volvería a fallar igual.
 */

/** Mensajes típicos de fetch sin conexión en Chrome, Firefox y Safari. */
const MENSAJES_DE_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error/i

export function esErrorDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return MENSAJES_DE_RED.test(error.message)
  if (typeof error !== 'object' || error === null) return false
  const { message, code } = error as { message?: unknown; code?: unknown }
  if (typeof code === 'string' && code.length > 0) return false
  return typeof message === 'string' && MENSAJES_DE_RED.test(message)
}
