/**
 * Compras de producto.
 *
 * Qué hace: convierte una compra en el movimiento que la hace entrar a la
 * bodega y en la referencia de costo (UltimaCompra) que usa la utilidad
 * semanal; y elige la última compra de un producto en una lista.
 * Cómo lo hace: funciones puras. La cantidad comprada se pasa a unidades con
 * aUnidades y el costo pagado se guarda tal cual, en pesos enteros.
 * Por qué: el stock solo cambia por movimientos, y la compra es la única
 * forma en que entra producto. El costo varía en cada compra, así que se
 * guarda por compra y la utilidad usa el de la más reciente.
 */
import { estaVigente, type EstadoRegistro } from '../compartido/estado'
import { validarFecha, validarFechaHoraIso, validarMonto } from '../compartido/validaciones'
import type { UltimaCompra } from '../cierres/utilidadSemanal'
import { aUnidades, type Presentacion, type ProductoConversion } from './conversiones'
import type { Movimiento } from './stock'

/** Una compra registrada: qué se compró, cuánto, cuándo y cuánto se pagó. */
export interface Compra {
  /** Identificador de la compra; sirve para corregirla o anularla después. */
  id: string
  /**
   * Número consecutivo que asigna la base al registrar (se muestra "C-042").
   * Es opcional porque una compra aún no guardada no lo tiene.
   */
  numero?: number
  productoId: string
  /** Datos del producto necesarios para pasar la cantidad a unidades. */
  producto: ProductoConversion
  presentacion: Presentacion
  /** Cantidad comprada en la presentación indicada (ej.: 2 cajas). */
  cantidad: number
  /** Lo que se pagó en total por esta compra, en pesos. */
  costoTotal: number
  /** Día de la compra, en formato AAAA-MM-DD. */
  fecha: string
  /**
   * Momento en que se registró la compra en el sistema, en ISO 8601 UTC
   * (ej.: 2026-01-10T15:00:00.000Z, el formato de Date.toISOString).
   * Sirve para saber cuál compra se registró de último cuando hay varias el
   * mismo día. Se eligió una marca de tiempo y no un número consecutivo
   * porque los dos usuarios pueden registrar sin conexión desde equipos
   * distintos, y un consecutivo exigiría coordinarse entre ellos. Con un
   * solo formato fijo, comparar el texto equivale a comparar el momento.
   */
  registradoEn: string
  /**
   * Vigente o anulada. Una compra anulada no se borra, pero deja de contar
   * como última compra y su entrada a la bodega se compensa.
   */
  estado: EstadoRegistro
}

/**
 * Calcula las unidades que entraron con una compra.
 *
 * Qué hace: devuelve las unidades compradas, que deben ser más de cero.
 * Cómo lo hace: usa aUnidades y rechaza el resultado cero.
 * Por qué: una compra de cero unidades no mueve inventario y, como
 * referencia de costo, obligaría a dividir entre cero.
 *
 * @throws Error si la cantidad no es un entero mayor a cero o la
 * presentación no aplica al producto.
 */
function unidadesCompradas(compra: Compra): number {
  const unidades = aUnidades(compra.producto, compra.presentacion, compra.cantidad)
  if (unidades === 0) {
    throw new Error('Una compra debe tener al menos una unidad')
  }
  return unidades
}

/**
 * Convierte una compra en su movimiento de inventario.
 *
 * Qué hace: devuelve un movimiento de tipo compra que suma en la bodega.
 * Cómo lo hace: pasa la cantidad a unidades y la deja con signo positivo.
 * Por qué: el producto comprado llega a la bodega; de ahí se traslada a la
 * nevera para venderse.
 *
 * @throws Error si la cantidad no es un entero mayor a cero.
 */
export function compraAMovimiento(compra: Compra): Movimiento {
  return {
    productoId: compra.productoId,
    tipo: 'compra',
    ubicacion: 'bodega',
    unidades: unidadesCompradas(compra),
  }
}

/**
 * Convierte una compra en la referencia de costo para la utilidad.
 *
 * Qué hace: devuelve las unidades que cubrió la compra y lo que se pagó.
 * Cómo lo hace: pasa la cantidad a unidades y valida el costo.
 * Por qué: guardar unidades y costo total (en vez del costo por unidad)
 * evita decimales; costoReposicion divide una sola vez al final.
 *
 * @throws Error si la cantidad no es un entero mayor a cero o si el costo no
 * es un entero mayor o igual a cero.
 */
export function compraAUltimaCompra(compra: Compra): UltimaCompra {
  validarMonto('El costo de la compra', compra.costoTotal)
  return {
    unidades: unidadesCompradas(compra),
    costoTotal: compra.costoTotal,
  }
}

/**
 * Elige la última compra de un producto.
 *
 * Qué hace: devuelve la compra vigente del producto con la fecha más
 * reciente y, si hay varias ese día, la que se registró de último; o
 * undefined si el producto no tiene compras vigentes. Con `fechaLimite`,
 * solo cuentan las compras con fecha igual o anterior a ese día.
 * Cómo lo hace: filtra por producto, valida fechas, momentos de registro y
 * estados, descarta las anuladas y las posteriores a la fecha límite, y
 * ordena por fecha y luego por momento de registro. Comparar texto
 * AAAA-MM-DD o ISO UTC equivale a comparar el tiempo.
 * Por qué: la utilidad semanal usa el costo de la última compra, que es lo
 * que cuesta reponer hoy. Las fechas de compra no tienen hora, así que el
 * momento de registro desempata compras del mismo día. La fecha límite deja
 * que un cierre use el costo vigente a su último día, de modo que
 * recalcularlo más tarde, con compras nuevas, dé el mismo resultado.
 *
 * @throws Error si alguna fecha (incluida la límite), momento de registro o
 * estado es inválido, o si las
 * dos compras más recientes empatan en fecha y en momento de registro: no
 * hay forma de saber cuál fue la última.
 */
export function ultimaCompraDe(
  compras: readonly Compra[],
  productoId: string,
  fechaLimite?: string,
): Compra | undefined {
  if (fechaLimite !== undefined) validarFecha('La fecha límite', fechaLimite)
  const delProducto = compras.filter((compra) => compra.productoId === productoId)
  delProducto.forEach((compra) => {
    validarFecha('La fecha de la compra', compra.fecha)
    validarFechaHoraIso('El momento de registro de la compra', compra.registradoEn)
  })
  // Una compra anulada no cuenta, ni siquiera para el empate.
  const noAnuladas = delProducto.filter((compra) => estaVigente(compra, `La compra ${compra.id}`))
  const vigentes =
    fechaLimite === undefined
      ? noAnuladas
      : noAnuladas.filter((compra) => compra.fecha <= fechaLimite)
  if (vigentes.length === 0) return undefined

  // De más reciente a más antigua: primero por fecha, luego por registro.
  const ordenadas = [...vigentes].sort(
    (a, b) =>
      b.fecha.localeCompare(a.fecha) || b.registradoEn.localeCompare(a.registradoEn),
  )
  const [ultima, anterior] = ordenadas
  if (
    anterior !== undefined &&
    anterior.fecha === ultima.fecha &&
    anterior.registradoEn === ultima.registradoEn
  ) {
    throw new Error(
      'Hay dos compras del producto con la misma fecha y registradas en el mismo momento; no se sabe cuál es la última',
    )
  }
  return ultima
}
