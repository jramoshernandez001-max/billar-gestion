/**
 * Conversión de una venta en movimientos de inventario.
 *
 * Qué hace: convierte los renglones de una venta en movimientos que restan
 * de la nevera las unidades vendidas.
 * Cómo lo hace: función pura que pasa cada renglón a unidades con aUnidades
 * y crea un movimiento de tipo venta con signo negativo.
 * Por qué: el stock nunca se edita; vender es una salida de la nevera, que
 * es donde está el producto listo para vender. El precio no importa aquí:
 * solo cuenta cuántas unidades salieron.
 */
import { aUnidades } from '../inventario/conversiones'
import type { Movimiento } from '../inventario/stock'
import type { ItemVenta } from './valorVenta'

/** Un renglón de venta con el identificador del producto vendido. */
export interface RenglonVenta extends ItemVenta {
  productoId: string
}

/**
 * Convierte los renglones de una venta en salidas de la nevera.
 *
 * Qué hace: devuelve un movimiento por renglón, en el mismo orden.
 * Cómo lo hace: calcula las unidades del renglón y las resta en la nevera.
 * Por qué: un movimiento por renglón deja ver en la historia de qué renglón
 * salió cada descuento.
 *
 * @throws Error si una cantidad no es un entero mayor o igual a cero o si se
 * vende sixpack de un producto que no lo maneja.
 */
export function ventaAMovimientos(renglones: readonly RenglonVenta[]): Movimiento[] {
  return renglones.map((renglon) => ({
    productoId: renglon.productoId,
    tipo: 'venta',
    ubicacion: 'nevera',
    // 0 - unidades en vez de -unidades: con cantidad cero da 0 y no -0,
    // que las comparaciones estrictas tratan como un valor distinto.
    unidades: 0 - aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad),
  }))
}
