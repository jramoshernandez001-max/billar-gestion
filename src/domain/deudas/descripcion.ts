/**
 * Descripción de deudas y abonos.
 *
 * Qué hace: limpia y valida el texto que justifica una deuda o un abono.
 * Cómo lo hace: funciones puras. normalizarDescripcion quita los espacios
 * de los lados, convierte en un solo espacio cualquier grupo de espacios,
 * tabulaciones o saltos de línea en medio y valida;
 * validarDescripcion exige que el texto ya llegue limpio. Los caracteres
 * se cuentan como los ve una persona (un emoji o una letra con tilde
 * cuentan uno), no como unidades internas de JavaScript.
 * Por qué: cada deuda y cada abono deben decir por qué existen, para que
 * después se entienda el movimiento. El máximo de 200 caracteres mantiene
 * la descripción corta y fácil de leer en el celular.
 */

/** Máximo de caracteres de una descripción. */
export const MAXIMO_DESCRIPCION = 200

/** Cualquier grupo de espacios, tabulaciones o saltos de línea seguidos. */
const GRUPOS_DE_BLANCOS = /\s+/g

/** Una tabulación o un salto de línea (no un espacio normal). */
const TABULACION_O_SALTO = /[\t\n\r\f\v]/

/**
 * Cuenta los caracteres de un texto como los ve una persona.
 *
 * Qué hace: devuelve la cantidad de caracteres.
 * Cómo lo hace: separa el texto en puntos de código con el operador de
 * propagación, que no parte los emojis en dos.
 * Por qué: length contaría un emoji como dos caracteres.
 */
function contarCaracteres(texto: string): number {
  return [...texto].length
}

/**
 * Valida una descripción que ya debe venir limpia.
 *
 * Qué hace: lanza un error si la descripción tiene espacios a los lados,
 * espacios repetidos, tabulaciones o saltos de línea en medio, está vacía
 * o pasa de 200 caracteres.
 * Cómo lo hace: compara el texto con su versión sin espacios a los lados,
 * busca espacios repetidos y revisa el largo.
 * Por qué: al calcular saldos no se cambian los datos; si una descripción
 * llega sucia, es un error de captura que se debe avisar, no esconder.
 *
 * @param nombre Nombre del campo, para que el mensaje diga cuál falló.
 * @throws Error si la descripción no cumple las reglas.
 */
export function validarDescripcion(nombre: string, descripcion: string): void {
  if (descripcion !== descripcion.trim()) {
    throw new Error(`${nombre} no debe tener espacios sobrantes a los lados`)
  }
  if (descripcion.includes('  ')) {
    throw new Error(`${nombre} no debe tener espacios repetidos`)
  }
  if (TABULACION_O_SALTO.test(descripcion)) {
    throw new Error(`${nombre} no debe tener tabulaciones ni saltos de línea`)
  }
  if (descripcion.length === 0) {
    throw new Error(`${nombre} es obligatoria`)
  }
  if (contarCaracteres(descripcion) > MAXIMO_DESCRIPCION) {
    throw new Error(`${nombre} no puede pasar de ${MAXIMO_DESCRIPCION} caracteres`)
  }
}

/**
 * Limpia y valida una descripción al capturarla.
 *
 * Qué hace: devuelve la descripción sin espacios a los lados y con un solo
 * espacio donde había varios seguidos, o una tabulación o un salto de línea.
 * Cómo lo hace: aplica trim, reemplaza cada grupo de blancos por un espacio
 * y luego aplica validarDescripcion.
 * Por qué: un espacio de más, o un salto de línea pegado desde otra app,
 * no debe impedir registrar la deuda; la descripción es de una sola línea
 * y el texto guardado debe quedar limpio.
 *
 * @throws Error si queda vacía o pasa de 200 caracteres.
 */
export function normalizarDescripcion(descripcion: string): string {
  const limpia = descripcion.trim().replace(GRUPOS_DE_BLANCOS, ' ')
  validarDescripcion('La descripción', limpia)
  return limpia
}
