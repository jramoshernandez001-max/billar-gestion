/**
 * Traslados de producto de la bodega a la nevera.
 *
 * Qué hace: convierte un traslado en sus dos movimientos de inventario y
 * dice si la bodega tenía unidades suficientes.
 * Cómo lo hace: función pura que arma un movimiento negativo en bodega y uno
 * positivo en nevera por las mismas unidades, y consulta
 * verificarDisponibilidad sobre el stock actual.
 * Por qué: el stock nunca se edita; un traslado es mover unidades de un
 * lugar a otro sin cambiar el total. El aviso informa pero no bloquea, igual
 * que verificarDisponibilidad: la pantalla decide si deja seguir o no.
 */
import { verificarDisponibilidad, type Disponibilidad } from './disponibilidad'
import type { Movimiento, Stock } from './stock'

/** Resultado de armar un traslado. */
export interface Traslado {
  /** Salida de la bodega y entrada a la nevera, en ese orden. */
  movimientos: [Movimiento, Movimiento]
  /** Si la bodega alcanzaba para el traslado y cuántas unidades faltan. */
  disponibilidad: Disponibilidad
}

/**
 * Arma el traslado de unidades de la bodega a la nevera.
 *
 * Qué hace: devuelve los dos movimientos del traslado y la disponibilidad
 * de la bodega.
 * Cómo lo hace: valida que las unidades sean un entero mayor a cero, crea
 * los dos movimientos con signos opuestos y verifica el stock de la bodega.
 * Por qué: los dos movimientos siempre van juntos; armarlos en un solo lugar
 * evita registrar la salida sin la entrada.
 *
 * @param productoId Producto que se traslada.
 * @param unidades Unidades que se pasan a la nevera.
 * @param stockActual Stock del producto antes del traslado.
 * @throws Error si las unidades no son un entero mayor a cero.
 */
export function trasladarANevera(
  productoId: string,
  unidades: number,
  stockActual: Stock,
): Traslado {
  // Un traslado de cero unidades no mueve nada y no debe quedar registrado.
  if (!Number.isInteger(unidades) || unidades <= 0) {
    throw new Error('Las unidades del traslado deben ser un entero mayor a cero')
  }

  return {
    movimientos: [
      { productoId, tipo: 'traslado', ubicacion: 'bodega', unidades: -unidades },
      { productoId, tipo: 'traslado', ubicacion: 'nevera', unidades },
    ],
    disponibilidad: verificarDisponibilidad(stockActual, 'bodega', unidades),
  }
}
