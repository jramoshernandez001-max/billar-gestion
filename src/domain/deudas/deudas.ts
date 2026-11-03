/**
 * Manejo de deudas y abonos.
 *
 * Qué hace: calcula cuánto sigue debiendo un cliente en una fecha y cuánto
 * suman las deudas que entran en el cierre de un periodo (un día o una semana).
 * Cómo lo hace: funciones puras que filtran las deudas y los abonos por fecha
 * y restan los abonos del monto. Las fechas van como texto AAAA-MM-DD, sin
 * hora, y el dinero en pesos enteros.
 * Por qué: las deudas se suman al dinero para cuadrar el cierre. Solo entran
 * las nacidas dentro del periodo y solo por lo que sigan debiendo a la fecha
 * de cierre: si ya se pagaron, no cuentan. Usar texto en vez de objetos Date
 * evita errores por zona horaria. Cada deuda y cada abono llevan una
 * descripción obligatoria que justifica el movimiento, y un estado: lo
 * anulado no se borra, pero no cuenta (una deuda anulada no debe nada y un
 * abono anulado no resta).
 */

import { estaVigente, type EstadoRegistro } from '../compartido/estado'
import { validarFecha, validarMonto } from '../compartido/validaciones'
import { validarDescripcion } from './descripcion'

/**
 * Comprueba que el monto de una deuda o de un abono sea mayor a cero.
 *
 * Qué hace: lanza un error si el monto no es un entero positivo.
 * Cómo lo hace: reutiliza validarMonto (entero, no negativo) y además
 * rechaza el cero.
 * Por qué: una deuda o un abono de cero pesos no representa ningún
 * movimiento real y solo llenaría la bitácora de ruido; la base de datos
 * aplica la misma regla.
 *
 * @param nombre Nombre del campo, para que el mensaje diga cuál falló.
 * @param valor Monto en pesos.
 * @throws Error si el valor no es un entero mayor a cero.
 */
function validarMontoPositivo(nombre: string, valor: number): void {
  validarMonto(nombre, valor)
  if (valor === 0) {
    throw new Error(`${nombre} debe ser mayor a cero`)
  }
}

/** Una deuda: alguien se llevó producto sin pagar. */
export interface Deuda {
  id: string
  cliente: string
  /** Día en que nació la deuda, en formato AAAA-MM-DD. */
  fecha: string
  /** Monto total que quedó debiendo, en pesos. */
  monto: number
  /** Por qué nació la deuda; obligatoria, sin espacios sobrantes, máx. 200. */
  descripcion: string
  /** Vigente o anulada; una deuda anulada no debe nada. */
  estado: EstadoRegistro
}

/** Un pago parcial o total de una deuda. */
export interface Abono {
  /** Identificador del abono; sirve para anularlo. */
  id: string
  deudaId: string
  /** Día del pago, en formato AAAA-MM-DD. */
  fecha: string
  /** Monto pagado, en pesos. */
  monto: number
  /** Qué justifica el abono; obligatoria, sin espacios sobrantes, máx. 200. */
  descripcion: string
  /** Vigente o anulada; un abono anulado no resta de la deuda. */
  estado: EstadoRegistro
}

/**
 * Calcula cuánto sigue debiendo una deuda en una fecha de corte.
 *
 * Qué hace: devuelve el monto de la deuda menos los abonos vigentes hechos
 * hasta esa fecha, inclusive; una deuda anulada devuelve cero.
 * Cómo lo hace: toma solo los abonos vigentes de esta deuda con fecha menor
 * o igual al corte y los resta del monto.
 * Por qué: un abono posterior al cierre todavía no había ocurrido, así que ese
 * día la deuda seguía pendiente. Lo anulado no se borra, pero no cuenta.
 *
 * @throws Error si alguna fecha, monto, descripción o estado es inválido, o
 * si los abonos superan el monto de la deuda.
 */
export function saldoPendiente(
  deuda: Deuda,
  abonos: readonly Abono[],
  fechaCorte: string,
): number {
  validarFecha('La fecha de corte', fechaCorte)
  validarFecha('La fecha de la deuda', deuda.fecha)
  validarMontoPositivo('El monto de la deuda', deuda.monto)
  validarDescripcion('La descripción de la deuda', deuda.descripcion)
  if (!estaVigente(deuda, `La deuda ${deuda.id}`)) return 0

  // Comparar texto AAAA-MM-DD equivale a comparar fechas.
  const abonosHastaElCorte = abonos.filter(
    (abono) =>
      abono.deudaId === deuda.id &&
      abono.fecha <= fechaCorte &&
      estaVigente(abono, `El abono ${abono.id}`),
  )

  const totalAbonado = abonosHastaElCorte.reduce((suma, abono) => {
    validarFecha('La fecha del abono', abono.fecha)
    validarMontoPositivo('El monto del abono', abono.monto)
    validarDescripcion('La descripción del abono', abono.descripcion)
    return suma + abono.monto
  }, 0)

  // Pagar más de lo debido es un error de captura, no un saldo negativo.
  if (totalAbonado > deuda.monto) {
    throw new Error('Los abonos superan el monto de la deuda')
  }

  return deuda.monto - totalAbonado
}

/**
 * Suma las deudas que entran en el cierre de un periodo.
 *
 * Qué hace: devuelve el total que siguen debiendo, a la fecha de cierre, las
 * deudas nacidas entre `desde` y `hasta`, ambos días incluidos.
 * Cómo lo hace: filtra las deudas por fecha de nacimiento y suma el saldo
 * pendiente de cada una calculado al día `hasta`.
 * Por qué: es la regla del cierre. Una deuda pagada dentro del periodo ya no
 * entra; una de periodos anteriores tampoco. El cierre diario es este mismo
 * cálculo con un periodo de un solo día (`desde` igual a `hasta`).
 *
 * @throws Error si las fechas son inválidas o si `desde` es posterior a `hasta`.
 */
export function totalDeudasPendientes(
  deudas: readonly Deuda[],
  abonos: readonly Abono[],
  desde: string,
  hasta: string,
): number {
  validarFecha('La fecha de inicio', desde)
  validarFecha('La fecha de fin', hasta)
  if (desde > hasta) {
    throw new Error('La fecha de inicio no puede ser posterior a la de fin')
  }

  return deudas
    .filter((deuda) => deuda.fecha >= desde && deuda.fecha <= hasta)
    .reduce((total, deuda) => total + saldoPendiente(deuda, abonos, hasta), 0)
}