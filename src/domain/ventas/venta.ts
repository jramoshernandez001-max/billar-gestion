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
import type { RenglonVenta } from './movimientosVenta'

/** Estados posibles de una venta. */
export type EstadoVenta = 'vigente' | 'anulada'

/** Lista de estados válidos, para revisar datos que llegan de afuera. */
const ESTADOS_VENTA: readonly string[] = ['vigente', 'anulada']

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
  return ventas.flatMap((venta) => {
    // El tipo protege al compilar; esto protege datos que llegan de afuera.
    if (!ESTADOS_VENTA.includes(venta.estado)) {
      throw new Error(`La venta ${venta.id} tiene un estado desconocido`)
    }
    return venta.estado === 'vigente' ? [...venta.renglones] : []
  })
}
