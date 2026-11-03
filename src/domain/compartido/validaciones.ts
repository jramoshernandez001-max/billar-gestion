/**
 * Validaciones compartidas por los módulos del dominio.
 *
 * Qué hace: reúne las reglas de validación que se repiten en varios módulos,
 * por ahora la de los montos de dinero.
 * Cómo lo hace: funciones puras que lanzan un error con un mensaje claro
 * cuando el valor no cumple la regla y no devuelven nada si es válido.
 * Por qué: la misma regla estaba copiada en tres archivos. Si una regla
 * cambia (por ejemplo, aceptar centavos), basta con tocarla aquí.
 */

/**
 * Comprueba que un monto sea un entero mayor o igual a cero.
 *
 * Qué hace: lanza un error si el monto no es válido.
 * Cómo lo hace: Number.isInteger rechaza decimales, NaN e infinito de una
 * vez, y luego se descartan los negativos.
 * Por qué: en pesos colombianos no se manejan decimales, y un monto negativo
 * o inválido falsearía el cuadre, las deudas o la utilidad en silencio.
 *
 * @param nombre Nombre del campo, para que el mensaje diga cuál falló.
 * @param valor Monto que se va a validar, en pesos.
 * @throws Error si el valor no es un entero mayor o igual a cero.
 */
export function validarMonto(nombre: string, valor: number): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nombre} debe ser un entero mayor o igual a cero`)
  }
}