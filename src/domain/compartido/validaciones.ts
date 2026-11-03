/**
 * Validaciones compartidas por los módulos del dominio.
 *
 * Qué hace: reúne las reglas de validación que se repiten en varios módulos,
 * por ahora la de los montos de dinero, la de las fechas y la de los
 * momentos (fecha y hora ISO en UTC).
 * Cómo lo hace: funciones puras que lanzan un error con un mensaje claro
 * cuando el valor no cumple la regla y no devuelven nada si es válido.
 * Por qué: la misma regla estaba copiada en varios archivos. Si una regla
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

/**
 * Comprueba que un texto sea una fecha real con formato AAAA-MM-DD.
 *
 * Qué hace: lanza un error si la fecha no es válida.
 * Cómo lo hace: revisa el formato con una expresión regular, construye la
 * fecha en UTC y confirma que exista y que sea el mismo día escrito (así se
 * rechaza 2026-02-30, que JavaScript convertiría en 2 de marzo).
 * Por qué: las fechas se comparan como texto; eso solo funciona si todas
 * tienen el mismo formato, y una fecha mal escrita daría resultados falsos
 * sin avisar. Se usa UTC para que la zona horaria no mueva el día.
 *
 * @param nombre Nombre del campo, para que el mensaje diga cuál falló.
 * @param fecha Texto que se va a validar.
 * @throws Error si no es una fecha real con formato AAAA-MM-DD.
 */
export function validarFecha(nombre: string, fecha: string): void {
  const tieneFormato = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
  const instante = tieneFormato ? new Date(`${fecha}T00:00:00Z`) : null
  // Un mes 13 da una fecha inválida (NaN); se revisa antes de toISOString,
  // que en ese caso lanzaría un error genérico sin nombrar el campo.
  const esReal =
    instante !== null &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString().slice(0, 10) === fecha
  if (!esReal) {
    throw new Error(`${nombre} debe ser una fecha válida con formato AAAA-MM-DD`)
  }
}

/** Formato exacto de Date.toISOString: así el texto se compara como tiempo. */
const FORMATO_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Comprueba que un texto sea una fecha y hora ISO 8601 en UTC real.
 *
 * Qué hace: lanza un error si el texto no tiene el formato de toISOString o
 * no es un momento que exista.
 * Cómo lo hace: revisa el formato con una expresión regular y confirma que
 * al convertirlo y volverlo a texto quede igual (así se rechaza un 30 de
 * febrero o una hora 25).
 * Por qué: los momentos (registro de una compra, cálculo de un cierre,
 * cambios en la bitácora) se ordenan comparando texto; eso solo funciona si
 * todos tienen el mismo formato y la misma zona horaria.
 *
 * @param nombre Nombre del campo, para que el mensaje diga cuál falló.
 * @param valor Texto que se va a validar.
 * @throws Error si no es una fecha y hora ISO en UTC real.
 */
export function validarFechaHoraIso(nombre: string, valor: string): void {
  const instante = new Date(valor)
  const esValido =
    FORMATO_ISO_UTC.test(valor) &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString() === valor
  if (!esValido) {
    throw new Error(`${nombre} debe ser una fecha y hora ISO en UTC`)
  }
}
