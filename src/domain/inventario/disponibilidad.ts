/**
 * Verificación de disponibilidad de stock.
 *
 * Qué hace: responde si hay suficientes unidades en bodega o en nevera para
 * sacar una cantidad, y cuántas faltan si no alcanzan.
 * Cómo lo hace: compara las unidades pedidas con las que hay en la ubicación
 * indicada del stock ya calculado. Es una función pura.
 * Por qué: avisar antes de registrar una venta o un traslado evita que el
 * inventario quede en negativo. Solo informa y no bloquea: así la pantalla
 * decide si avisa o impide, y el usuario no se queda sin poder cerrar el día
 * por haber olvidado registrar un traslado.
 */
import type { Stock, Ubicacion } from './stock'

/** Resultado de comprobar si alcanza el stock. */
export interface Disponibilidad {
  /** Verdadero si hay unidades suficientes en la ubicación. */
  suficiente: boolean
  /** Unidades que faltan; cero cuando alcanza. */
  faltan: number
}

/**
 * Comprueba si alcanza el stock de una ubicación para sacar cierta cantidad.
 *
 * Qué hace: devuelve si alcanza y cuántas unidades faltan.
 * Cómo lo hace: resta lo pedido menos lo disponible en esa ubicación; si la
 * resta no es positiva, alcanza.
 * Por qué: la bodega y la nevera son lugares distintos; tener producto en
 * bodega no sirve para vender si no está en la nevera.
 *
 * @throws Error si las unidades pedidas no son un entero mayor o igual a cero.
 */
export function verificarDisponibilidad(
  stock: Stock,
  ubicacion: Ubicacion,
  unidadesPedidas: number,
): Disponibilidad {
  if (!Number.isInteger(unidadesPedidas) || unidadesPedidas < 0) {
    throw new Error('Las unidades pedidas deben ser un entero mayor o igual a cero')
  }

  const faltan = Math.max(0, unidadesPedidas - stock[ubicacion])

  return { suficiente: faltan === 0, faltan }
}