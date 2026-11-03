/**
 * Anulación de movimientos de inventario.
 *
 * Qué hace: dado un conjunto de movimientos (los de una compra, un traslado
 * o una venta), produce los movimientos inversos que lo compensan.
 * Cómo lo hace: función pura que copia cada movimiento con el signo de sus
 * unidades invertido, conservando producto, tipo y ubicación.
 * Por qué: nada se borra. Para deshacer un registro se agregan movimientos
 * contrarios; así el historial muestra el error y su corrección, y el stock
 * (la suma de movimientos) vuelve a quedar como antes. Se conserva el tipo
 * para que lo anulado se descuente de su propio tipo: anular una venta
 * reduce las unidades vendidas, no aparece como una compra.
 */
import type { Movimiento } from './stock'

/**
 * Produce los movimientos que compensan a otros.
 *
 * Qué hace: devuelve un movimiento inverso por cada movimiento recibido, en
 * el mismo orden.
 * Cómo lo hace: invierte el signo de las unidades y deja el resto igual.
 * Por qué: sumados a los originales dan cero en cada producto y ubicación.
 *
 * @throws Error si la lista está vacía (no hay nada que anular) o si algún
 * movimiento tiene unidades que no son un entero.
 */
export function movimientosInversos(movimientos: readonly Movimiento[]): Movimiento[] {
  if (movimientos.length === 0) {
    throw new Error('No hay movimientos que anular')
  }
  return movimientos.map((movimiento) => {
    if (!Number.isInteger(movimiento.unidades)) {
      throw new Error('Las unidades de un movimiento deben ser un entero')
    }
    // 0 - unidades en vez de -unidades: con cero da 0 y no -0.
    return { ...movimiento, unidades: 0 - movimiento.unidades }
  })
}
