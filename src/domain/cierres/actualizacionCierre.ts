/**
 * Cierres guardados: cuándo se calcularon, si quedaron desactualizados y
 * cómo se recalculan.
 *
 * Qué hace: guarda un cierre (diario o semanal) con el momento en que se
 * calculó; dice si quedó desactualizado porque después se anuló o corrigió
 * algo que él usó, o porque se registró algo nuevo con fecha de su periodo;
 * y lo recalcula a mano dejándolo al día, con su registro en la bitácora.
 * Cómo lo hace: funciones puras. Los momentos van en ISO UTC y se comparan
 * como texto. Un cambio afecta al cierre si se hizo (o se registró) después
 * del cálculo y podría cambiar su resultado: una venta, deuda o abono con
 * fecha dentro del periodo; una compra anulada o corregida que el cierre
 * usó como costo; o una compra nueva que pasaría a ser la última de un
 * producto vendido.
 * Por qué: nada se borra; las anulaciones y correcciones se agregan después.
 * Un cierre calculado antes de ellas muestra números viejos, y hay que
 * saberlo para recalcularlo. Lo mismo pasa con un registro nuevo cuya fecha
 * cae en un periodo ya cerrado: se permite, pero deja el cierre
 * desactualizado. El recálculo siempre lo pide un usuario; nunca es
 * automático. Las compras se miran por la compra usada y no por el periodo,
 * porque el cierre semanal usa la última compra hasta el domingo, que puede
 * ser anterior a la semana, y una compra que no cambia ese costo no cambia
 * su resultado.
 */
import { crearRegistroBitacora, type RegistroBitacora } from '../compartido/bitacora'
import { validarSemana } from '../compartido/semana'
import { validarFecha, validarFechaHoraIso } from '../compartido/validaciones'
import type { CostoUsado } from './cierreSemanal'

/** Clase de cierre. */
export type TipoCierre = 'diario' | 'semanal'

/** Un cierre ya calculado, con el momento del cálculo. */
export interface CierreGuardado<R> {
  tipo: TipoCierre
  /** Primer día del periodo, AAAA-MM-DD. */
  desde: string
  /** Último día del periodo, AAAA-MM-DD (igual a desde en el diario). */
  hasta: string
  /** Momento en que se calculó, en ISO UTC. */
  calculadoEn: string
  /**
   * Por producto vendido, la compra usada como costo o null si no hubo;
   * vacío en el diario, que no usa costos.
   */
  costosUsados: readonly CostoUsado[]
  /** Lo que devolvió el cálculo (cerrarDia o cerrarSemana). */
  resultado: R
}

/** Datos para guardar un cierre recién calculado. */
export interface DatosGuardarCierre<R> {
  tipo: TipoCierre
  desde: string
  hasta: string
  /** Cuándo se calculó. */
  momento: Date
  costosUsados: readonly CostoUsado[]
  resultado: R
}

/** Qué clase de registro se anuló o corrigió. */
export type RegistroAfectado = 'venta' | 'compra' | 'deuda' | 'abono'

/** Una anulación, una corrección o un registro nuevo. */
export interface CambioRegistro {
  tipoCambio: 'anulacion' | 'correccion-costo' | 'registro-nuevo'
  registro: RegistroAfectado
  /** Id del registro anulado o corregido. */
  id: string
  /** Fecha AAAA-MM-DD del registro afectado (no la del cambio). */
  fecha: string
  /**
   * Momento en que se hizo el cambio, en ISO UTC. En un registro nuevo es
   * su momento de registro (en una compra, su registradoEn).
   */
  momento: string
  /** Producto de la compra; obligatorio en una compra nueva. */
  productoId?: string
}

/** Datos para recalcular un cierre. */
export interface DatosRecalculo<R> {
  anterior: CierreGuardado<R>
  /** Resultado nuevo, calculado otra vez con los datos vigentes. */
  resultado: R
  costosUsados: readonly CostoUsado[]
  usuario: string
  momento: Date
}

/** Cierre recalculado y su registro de bitácora. */
export interface Recalculo<R> {
  cierre: CierreGuardado<R>
  registro: RegistroBitacora<CierreGuardado<R>>
}

/**
 * Comprueba que el periodo corresponda al tipo de cierre.
 *
 * Qué hace: lanza un error si un diario no es de un solo día o si un
 * semanal no va de lunes a domingo.
 * Cómo lo hace: valida las fechas y, según el tipo, compara desde con hasta
 * o usa validarSemana.
 * Por qué: estaDesactualizado decide por el periodo; un periodo mal formado
 * daría respuestas falsas.
 */
function validarPeriodo(tipo: TipoCierre, desde: string, hasta: string): void {
  if (tipo === 'semanal') {
    validarSemana(desde, hasta)
    return
  }
  validarFecha('La fecha del cierre diario', desde)
  validarFecha('La fecha del cierre diario', hasta)
  if (desde !== hasta) {
    throw new Error('Un cierre diario es de un solo día: desde y hasta deben ser iguales')
  }
}

/**
 * Pasa un momento a texto ISO UTC, validándolo.
 *
 * Qué hace: devuelve el momento como toISOString.
 * Cómo lo hace: revisa que el Date sea válido antes de convertirlo.
 * Por qué: un Date inválido haría fallar toISOString con un error genérico.
 */
function momentoIso(nombre: string, momento: Date): string {
  if (Number.isNaN(momento.getTime())) {
    throw new Error(`${nombre} no es una fecha y hora válida`)
  }
  return momento.toISOString()
}

/**
 * Guarda un cierre recién calculado.
 *
 * Qué hace: devuelve el cierre con su periodo, el momento del cálculo, las
 * compras que usó y el resultado.
 * Cómo lo hace: valida el periodo según el tipo y pasa el momento a ISO UTC.
 * Por qué: sin el momento del cálculo no se puede saber si un cambio
 * posterior lo dejó desactualizado.
 *
 * @throws Error si el periodo no corresponde al tipo o el momento es inválido.
 */
export function guardarCierre<R>(datos: DatosGuardarCierre<R>): CierreGuardado<R> {
  validarPeriodo(datos.tipo, datos.desde, datos.hasta)
  return {
    tipo: datos.tipo,
    desde: datos.desde,
    hasta: datos.hasta,
    calculadoEn: momentoIso('El momento del cálculo', datos.momento),
    costosUsados: datos.costosUsados.map((costo) => ({ ...costo })),
    resultado: datos.resultado,
  }
}

/**
 * Dice si una compra nueva podría cambiar el costo que usó un cierre.
 *
 * Qué hace: devuelve true si la compra pasaría a ser la última de un
 * producto vendido en el cierre.
 * Cómo lo hace: busca el costo usado del producto; si el cierre no lo
 * vendió, o la compra es posterior al último día, no afecta. Si el producto
 * se vendió sin compra, cualquier compra hasta el último día afecta. Si no,
 * afecta cuando su fecha es igual o posterior a la de la compra usada.
 * Por qué: con la misma fecha, manda la registrada de último, y la nueva
 * siempre se registró después de calcular el cierre.
 *
 * @throws Error si falta el producto de la compra.
 */
function compraNuevaAfecta<R>(cierre: CierreGuardado<R>, cambio: CambioRegistro): boolean {
  if (cambio.productoId === undefined || cambio.productoId.trim().length === 0) {
    throw new Error('Una compra nueva debe indicar su producto')
  }
  const costo = cierre.costosUsados.find((usado) => usado.productoId === cambio.productoId)
  if (costo === undefined || cambio.fecha > cierre.hasta) return false
  if (costo.compra === null) return true
  return cambio.fecha >= costo.compra.fecha
}

/**
 * Dice si un cambio afecta a un cierre.
 *
 * Qué hace: devuelve true si el cambio se hizo después del cálculo y
 * podría cambiar su resultado.
 * Cómo lo hace: compara momentos ISO como texto. Una compra anulada o
 * corregida se busca por id entre las usadas; una compra nueva se revisa
 * con compraNuevaAfecta; lo demás, por fecha dentro del periodo.
 * Por qué: un cambio anterior al cálculo ya estaba incluido en él. Una
 * corrección de costo solo puede ser de una compra.
 *
 * @throws Error si la fecha o el momento del cambio son inválidos, si una
 * corrección de costo no es de una compra o si una compra nueva no indica
 * su producto.
 */
function afectaAlCierre<R>(cierre: CierreGuardado<R>, cambio: CambioRegistro): boolean {
  validarFecha('La fecha del registro cambiado', cambio.fecha)
  validarFechaHoraIso('El momento del cambio', cambio.momento)
  if (cambio.tipoCambio === 'correccion-costo' && cambio.registro !== 'compra') {
    throw new Error('Una corrección de costo solo puede ser de una compra')
  }
  if (cambio.momento <= cierre.calculadoEn) return false
  if (cambio.registro === 'compra') {
    if (cambio.tipoCambio === 'registro-nuevo') return compraNuevaAfecta(cierre, cambio)
    return cierre.costosUsados.some((usado) => usado.compra?.id === cambio.id)
  }
  return cambio.fecha >= cierre.desde && cambio.fecha <= cierre.hasta
}

/**
 * Dice si un cierre quedó desactualizado.
 *
 * Qué hace: devuelve true si algún cambio lo afecta.
 * Cómo lo hace: revisa cada cambio con afectaAlCierre.
 * Por qué: si quedó desactualizado, hay que recalcularlo para que muestre
 * los números vigentes.
 *
 * @throws Error si algún cambio es inválido.
 */
export function estaDesactualizado<R>(
  cierre: CierreGuardado<R>,
  cambios: readonly CambioRegistro[],
): boolean {
  // Se validan todos los cambios aunque uno ya lo desactualice, para no
  // dejar pasar datos inválidos.
  return cambios.map((cambio) => afectaAlCierre(cierre, cambio)).some(Boolean)
}

/**
 * Recalcula un cierre y lo deja al día.
 *
 * Qué hace: devuelve el cierre con el resultado nuevo y el momento del
 * recálculo, y el registro de bitácora con el cierre de antes y el de
 * después.
 * Cómo lo hace: guarda el resultado nuevo con el mismo tipo y periodo, y
 * arma el registro con la acción de recálculo que corresponde al tipo.
 * Por qué: el cierre anterior no se borra, queda en la bitácora. Con el
 * nuevo momento de cálculo, los cambios ya incluidos dejan de afectarlo.
 *
 * @throws Error si el momento es inválido o falla alguna validación de la
 * bitácora.
 */
export function recalcularCierre<R>(datos: DatosRecalculo<R>): Recalculo<R> {
  const { anterior } = datos
  const cierre = guardarCierre({
    tipo: anterior.tipo,
    desde: anterior.desde,
    hasta: anterior.hasta,
    momento: datos.momento,
    costosUsados: datos.costosUsados,
    resultado: datos.resultado,
  })
  return {
    cierre,
    registro: crearRegistroBitacora({
      usuario: datos.usuario,
      momento: datos.momento,
      accion: anterior.tipo === 'diario' ? 'recalcular-cierre-diario' : 'recalcular-cierre-semanal',
      antes: anterior,
      despues: cierre,
    }),
  }
}
