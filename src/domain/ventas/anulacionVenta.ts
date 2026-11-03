/**
 * Anulación de una venta.
 *
 * Qué hace: anula una venta vigente: devuelve la venta con estado anulada,
 * el registro de anulación para la bitácora y los movimientos que regresan
 * a la nevera las unidades que la venta había descontado.
 * Cómo lo hace: función pura que copia la venta cambiando solo el estado, y
 * reutiliza crearRegistroAnulacion, ventaAMovimientos y movimientosInversos.
 * Por qué: nada se borra. La venta queda guardada con su estado nuevo, la
 * bitácora guarda cómo estaba antes y cómo quedó, y el stock vuelve a
 * cuadrar con movimientos contrarios. Si la venta era de un periodo ya
 * cerrado, ese cierre queda desactualizado hasta que un usuario lo
 * recalcule a mano; nunca se recalcula solo.
 */
import { crearRegistroAnulacion, type RegistroAnulacion } from '../compartido/anulacion'
import { movimientosInversos } from '../inventario/anulaciones'
import type { Movimiento } from '../inventario/stock'
import { ventaAMovimientos } from './movimientosVenta'
import type { Venta } from './venta'

/** Datos para anular una venta. */
export interface DatosAnulacionVenta {
  venta: Venta
  /** Por qué se anula; obligatorio. */
  motivo: string
  usuario: string
  momento: Date
}

/** Resultado de anular una venta. */
export interface VentaAnulada {
  /** La venta con estado anulada. */
  venta: Venta
  /** Registro de bitácora con la venta antes y después. */
  registro: RegistroAnulacion<Venta>
  /** Movimientos que devuelven las unidades a la nevera. */
  movimientos: Movimiento[]
}

/**
 * Anula una venta vigente.
 *
 * Qué hace: devuelve la venta anulada, su registro y los movimientos
 * inversos.
 * Cómo lo hace: rechaza una venta ya anulada, copia la venta con estado
 * anulada, arma el registro con el motivo y calcula los movimientos que
 * compensan los de la venta.
 * Por qué: anular dos veces la misma venta devolvería el producto dos veces
 * a la nevera.
 *
 * @throws Error si la venta ya está anulada, si el motivo está vacío o si
 * falla alguna validación de la bitácora o de los renglones.
 */
export function anularVenta(datos: DatosAnulacionVenta): VentaAnulada {
  if (datos.venta.estado === 'anulada') {
    throw new Error(`La venta ${datos.venta.id} ya está anulada`)
  }
  const anulada: Venta = { ...datos.venta, estado: 'anulada' }
  const salidas = ventaAMovimientos(datos.venta.renglones)

  return {
    venta: anulada,
    registro: crearRegistroAnulacion({
      usuario: datos.usuario,
      momento: datos.momento,
      motivo: datos.motivo,
      antes: datos.venta,
      despues: anulada,
    }),
    // Una venta sin renglones no movió inventario: no hay nada que devolver.
    movimientos: salidas.length === 0 ? [] : movimientosInversos(salidas),
  }
}
