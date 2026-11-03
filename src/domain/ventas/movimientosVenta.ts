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
 * Qué hace: devuelve un movimiento por renglón con unidades, en el mismo
 * orden; un renglón de cantidad cero se ignora.
 * Cómo lo hace: calcula las unidades de cada renglón, descarta los que dan
 * cero y resta las demás en la nevera.
 * Por qué: un movimiento por renglón deja ver en la historia de qué renglón
 * salió cada descuento. Un renglón de cantidad cero no mueve inventario, así
 * que no deja un movimiento vacío.
 *
 * @throws Error si una cantidad no es un entero mayor o igual a cero o si se
 * vende sixpack de un producto que no lo maneja.
 */
export function ventaAMovimientos(renglones: readonly RenglonVenta[]): Movimiento[] {
  return renglones.flatMap((renglon): Movimiento[] => {
    const unidades = aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad)
    if (unidades === 0) return []
    return [{ productoId: renglon.productoId, tipo: 'venta', ubicacion: 'nevera', unidades: -unidades }]
  })
}
