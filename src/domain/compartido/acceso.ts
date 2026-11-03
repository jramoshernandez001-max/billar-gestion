/**
 * Control de acceso por lista de correos autorizados.
 *
 * Qué hace: dice si un correo de Google puede entrar al sistema.
 * Cómo lo hace: funciones puras que normalizan el correo (sin espacios a los
 * lados y en minúsculas) y lo buscan en la lista, normalizada igual.
 * Por qué: el login es solo con Google y solo para los correos de la lista.
 * Los correos no distinguen mayúsculas en la práctica, y un espacio copiado
 * por error no debe dejar fuera a alguien autorizado. Esta comprobación es
 * de la app; la protección real de los datos la da RLS en la base de datos.
 */

/**
 * Normaliza un correo para compararlo.
 *
 * Qué hace: devuelve el correo sin espacios a los lados y en minúsculas.
 * Cómo lo hace: trim y toLowerCase.
 * Por qué: comparar siempre la misma forma del correo evita falsos rechazos.
 */
function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase()
}

/**
 * Dice si un correo está en la lista de autorizados.
 *
 * Qué hace: devuelve true solo si el correo, normalizado, coincide
 * exactamente con alguno de la lista, también normalizado.
 * Cómo lo hace: normaliza ambos lados y compara texto completo, no partes.
 * Por qué: un correo vacío nunca se autoriza, aunque la lista traiga uno
 * vacío por error, para no abrir la puerta a una sesión sin correo.
 */
export function estaAutorizado(
  correo: string,
  autorizados: readonly string[],
): boolean {
  const buscado = normalizarCorreo(correo)
  if (buscado.length === 0) return false
  return autorizados.some((autorizado) => normalizarCorreo(autorizado) === buscado)
}
