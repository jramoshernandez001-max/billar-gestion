/**
 * Venta con estado.
 *
 * Qué hace: define una venta (id, fecha, estado y renglones) y saca de una
 * lista de ventas los renglones de las que siguen vigentes.
 * Cómo lo hace: función pura que filtra por estado y junta los renglones en
 * el orden en que vienen.
 * Por qué: nada se borra. Una venta mal registrada se anula cambiando su
 * estado, y desde ese momento no debe sumar en los cierres; pero sigue
 * existiendo para la bitácora y el historial.
 */
import { estaVigente, type EstadoRegistro } from '../compartido/estado'
import { aUnidades } from '../inventario/conversiones'
import type { RenglonVenta } from './movimientosVenta'

/** Estados posibles de una venta: los mismos de todo registro anulable. */
export type EstadoVenta = EstadoRegistro

/** Una venta registrada. */
export interface Venta {
  id: string
  /** Día de la venta, en formato AAAA-MM-DD. */
  fecha: string
  estado: EstadoVenta
  renglones: readonly RenglonVenta[]
}

/**
 * Junta los renglones de las ventas vigentes.
 *
 * Qué hace: devuelve todos los renglones de las ventas en estado vigente.
 * Cómo lo hace: valida el estado de cada venta, descarta las anuladas y
 * aplana sus renglones.
 * Por qué: los cierres suman solo lo vendido de verdad; una venta anulada
 * queda guardada, pero ya no cuenta.
 *
 * @throws Error si alguna venta tiene un estado desconocido.
 */
export function renglonesVigentes(ventas: readonly Venta[]): RenglonVenta[] {
  return ventas.flatMap((venta) =>
    estaVigente(venta, `La venta ${venta.id}`) ? [...venta.renglones] : [],
  )
}

/**
 * Deja los renglones de una venta que se deben guardar.
 *
 * Qué hace: devuelve los renglones con cantidad, sin los de cantidad cero.
 * Cómo lo hace: valida cada renglón con aUnidades y descarta los que dan
 * cero unidades; si no queda ninguno, lanza un error.
 * Por qué: un renglón de cantidad cero se ignora sin error, porque no vende
 * nada; pero una venta en la que todos los renglones son cero (o que no
 * tiene renglones) no es una venta, y guardarla dejaría un registro vacío.
 *
 * @throws Error si una cantidad no es un entero mayor o igual a cero, si se
 * pide sixpack de un producto que no lo maneja, o si no queda ningún
 * renglón con cantidad.
 */
export function renglonesParaRegistrar(renglones: readonly RenglonVenta[]): RenglonVenta[] {
  const conCantidad = renglones.filter(
    (renglon) => aUnidades(renglon.producto, renglon.presentacion, renglon.cantidad) > 0,
  )
  if (conCantidad.length === 0) {
    throw new Error('La venta no tiene nada que registrar: todos los renglones tienen cantidad cero')
  }
  return conCantidad
}
