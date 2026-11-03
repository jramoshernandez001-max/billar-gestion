/**
 * Resumen de deudas para la pantalla de deudas.
 *
 * Qué hace: devuelve, por cada deuda, su saldo pendiente, su estado
 * (pendiente, pagada o anulada) y sus abonos ordenados por fecha, más el
 * total que se debe a la fecha de corte.
 * Cómo lo hace: usa `saldoPendiente` del dominio (que ignora lo anulado y los
 * abonos posteriores al corte) y agrupa los abonos por deuda.
 * Por qué: la pantalla solo dibuja este resumen; el cálculo del saldo vive en
 * un solo lugar, el mismo que usan los cierres.
 */
import { saldoPendiente, type Abono, type Deuda } from '../domain/deudas/deudas'

/** Estado de cobro de una deuda a la fecha de corte. */
export type EstadoCobro = 'pendiente' | 'pagada' | 'anulada'

/** Una fila de la lista de deudas. */
export interface FilaDeuda {
  deuda: Deuda
  /** Lo que sigue debiendo a la fecha de corte, en pesos. */
  saldo: number
  estado: EstadoCobro
  /** Todos sus abonos (vigentes y anulados) por fecha. */
  abonos: Abono[]
}

/** Lista de deudas con el total pendiente. */
export interface ResumenDeudas {
  filas: FilaDeuda[]
  /** Suma de los saldos de las deudas vigentes, en pesos. */
  totalPendiente: number
}

/**
 * Resume las deudas a una fecha de corte.
 * @throws Error si la fecha es inválida o los abonos superan una deuda.
 */
export function resumirDeudas(
  deudas: readonly Deuda[],
  abonos: readonly Abono[],
  corte: string,
): ResumenDeudas {
  const filas = deudas.map((deuda): FilaDeuda => {
    const propios = abonos
      .filter((a) => a.deudaId === deuda.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const saldo = saldoPendiente(deuda, propios, corte)
    const estado: EstadoCobro = deuda.estado === 'anulada' ? 'anulada' : saldo === 0 ? 'pagada' : 'pendiente'
    return { deuda, saldo, estado, abonos: propios }
  })
  return { filas, totalPendiente: filas.reduce((suma, f) => suma + f.saldo, 0) }
}
