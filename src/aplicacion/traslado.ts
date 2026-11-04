/**
 * Evaluación de un traslado de bodega a nevera.
 *
 * Qué hace: dice si las unidades pedidas se pueden trasladar, cuántas faltan
 * en la bodega y cuál es el máximo disponible.
 * Cómo lo hace: compara lo pedido con lo que hay en bodega (un stock
 * negativo cuenta como cero disponible).
 * Por qué: la base solo avisa cuando la bodega no alcanza, pero el diseño
 * bloquea el botón para no dejar la bodega en negativo sin querer; esa regla
 * de la pantalla vive aquí para poder probarla.
 */

/** Resultado de evaluar un traslado. */
export interface EvaluacionTraslado {
  /** vacio: sin cantidad aún; invalida: no es un entero mayor a cero. */
  estado: 'vacio' | 'ok' | 'excede' | 'invalida'
  /** Unidades que se pueden trasladar como máximo. */
  maximo: number
  /** Unidades que faltan en bodega para cubrir lo pedido (0 si alcanza). */
  faltan: number
  puedeRegistrar: boolean
}

/** Evalúa pedir `solicitadas` unidades con `enBodega` disponibles. */
export function evaluarTraslado(enBodega: number, solicitadas: number | null): EvaluacionTraslado {
  const maximo = Math.max(0, enBodega)
  if (solicitadas === null) return { estado: 'vacio', maximo, faltan: 0, puedeRegistrar: false }
  if (!Number.isInteger(solicitadas) || solicitadas <= 0) {
    return { estado: 'invalida', maximo, faltan: 0, puedeRegistrar: false }
  }
  if (solicitadas > maximo) return { estado: 'excede', maximo, faltan: solicitadas - maximo, puedeRegistrar: false }
  return { estado: 'ok', maximo, faltan: 0, puedeRegistrar: true }
}
