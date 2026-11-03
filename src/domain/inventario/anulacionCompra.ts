/**
 * Anulación de una compra.
 *
 * Qué hace: anula una compra vigente: devuelve la compra con estado anulada,
 * el registro de anulación para la bitácora y el movimiento que saca de la
 * bodega lo que la compra había metido.
 * Cómo lo hace: función pura que copia la compra cambiando solo el estado y
 * reutiliza crearRegistroAnulacion, compraAMovimiento y movimientosInversos.
 * Por qué: nada se borra. La compra queda guardada con su estado nuevo, la
 * bitácora guarda cómo estaba y cómo quedó, y el stock vuelve a cuadrar con
 * un movimiento contrario. Una compra anulada deja de contar como última
 * compra, así que el costo de reposición vuelve a la compra anterior.
 */
import { crearRegistroAnulacion, type RegistroAnulacion } from '../compartido/anulacion'
import { movimientosInversos } from './anulaciones'
import { compraAMovimiento, type Compra } from './compras'
import type { Movimiento } from './stock'

/** Datos para anular una compra. */
export interface DatosAnulacionCompra {
  compra: Compra
  /** Por qué se anula; obligatorio. */
  motivo: string
  usuario: string
  momento: Date
}

/** Resultado de anular una compra. */
export interface CompraAnulada {
  compra: Compra
  registro: RegistroAnulacion<Compra>
  /** Movimiento que compensa la entrada a la bodega. */
  movimientos: Movimiento[]
}

/**
 * Anula una compra vigente.
 *
 * Qué hace: devuelve la compra anulada, su registro y el movimiento inverso.
 * Cómo lo hace: rechaza una compra ya anulada, copia la compra con estado
 * anulada, arma el registro con el motivo y compensa su movimiento.
 * Por qué: anular dos veces sacaría el producto dos veces de la bodega.
 *
 * @throws Error si la compra ya está anulada, si el motivo está vacío o si
 * falla alguna validación de la bitácora o de la compra.
 */
export function anularCompra(datos: DatosAnulacionCompra): CompraAnulada {
  if (datos.compra.estado === 'anulada') {
    throw new Error(`La compra ${datos.compra.id} ya está anulada`)
  }
  const anulada: Compra = { ...datos.compra, estado: 'anulada' }
  return {
    compra: anulada,
    registro: crearRegistroAnulacion({
      usuario: datos.usuario,
      momento: datos.momento,
      motivo: datos.motivo,
      antes: datos.compra,
      despues: anulada,
    }),
    movimientos: movimientosInversos([compraAMovimiento(datos.compra)]),
  }
}
