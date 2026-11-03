/**
 * Validación de los datos que la app manda a la base.
 *
 * Qué hace: reúne las comprobaciones pequeñas que se repiten antes de llamar
 * a una función de la base: textos obligatorios, enteros, ids y listas
 * cerradas; y las de la forma de las respuestas.
 * Cómo lo hace: funciones que lanzan un error claro, con el nombre del campo.
 * Por qué: avisar de un dato mal puesto antes de ir a la base ahorra un viaje
 * y da un mensaje más claro. Es una ayuda: la base de datos vuelve a validar
 * todo y es la que manda.
 */

/** Exige un id (texto no vacío). */
export function exigirId(nombre: string, valor: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw new Error(`${nombre} es obligatorio`)
  }
  return valor.trim()
}

/** Exige un texto con contenido y lo devuelve sin espacios a los lados. */
export function exigirTexto(nombre: string, valor: string): string {
  const limpio = typeof valor === 'string' ? valor.trim() : ''
  if (limpio.length === 0) throw new Error(`${nombre} es obligatorio`)
  return limpio
}

/** Exige un entero mayor a cero. */
export function exigirEnteroPositivo(nombre: string, valor: number): number {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser un entero mayor a cero`)
  }
  return valor
}

/** Exige un entero distinto de cero (puede ser negativo). */
export function exigirEnteroNoCero(nombre: string, valor: number): number {
  if (!Number.isInteger(valor) || valor === 0) {
    throw new Error(`${nombre} debe ser un entero distinto de cero`)
  }
  return valor
}

/** Exige que el valor sea uno de una lista cerrada. */
export function exigirUnoDe<T extends string>(nombre: string, valor: string, permitidos: readonly T[]): T {
  if (!(permitidos as readonly string[]).includes(valor)) {
    throw new Error(`${nombre} debe ser ${permitidos.join(', ')}`)
  }
  return valor as T
}

/** Error para una respuesta de la base con forma inesperada. */
export function respuestaInesperada(): Error {
  return new Error('La respuesta de la base de datos no tiene la forma esperada')
}

/** Exige que la respuesta de una función sea un id (texto). */
export function exigirIdRespuesta(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length === 0) throw respuestaInesperada()
  return valor
}

/** Dice si un valor es un objeto simple (no nulo ni lista). */
export function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Dice si un valor es un entero seguro. */
export function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor)
}
