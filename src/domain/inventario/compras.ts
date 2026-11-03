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
import { validarFecha, validarMonto } from '../compartido/validaciones'
import type { UltimaCompra } from '../cierres/utilidadSemanal'
import { aUnidades, type Presentacion, type ProductoConversion } from './conversiones'
import type { Movimiento } from './stock'

/** Una compra registrada: qué se compró, cuánto, cuándo y cuánto se pagó. */
export interface Compra {
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
}

/** Formato exacto de Date.toISOString: así el texto se compara como fecha. */
const FORMATO_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Comprueba que el momento de registro sea una fecha y hora ISO UTC real.
 *
 * Qué hace: lanza un error si el texto no tiene el formato de toISOString o
 * no es un momento que exista.
 * Cómo lo hace: revisa el formato con una expresión regular y confirma que
 * al convertirlo y volverlo a texto quede igual.
 * Por qué: el orden de registro se decide comparando texto; con otro formato
 * la comparación daría un orden falso sin avisar.
 */
function validarRegistradoEn(registradoEn: string): void {
  const instante = new Date(registradoEn)
  const esValido =
    FORMATO_ISO_UTC.test(registradoEn) &&
    !Number.isNaN(instante.getTime()) &&
    instante.toISOString() === registradoEn
  if (!esValido) {
    throw new Error('El momento de registro de la compra debe ser una fecha y hora ISO en UTC')
  }
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
 * Qué hace: devuelve la compra del producto con la fecha más reciente y, si
 * hay varias ese día, la que se registró de último; o undefined si el
 * producto no tiene compras.
 * Cómo lo hace: filtra por producto, valida fechas y momentos de registro, y
 * ordena por fecha y luego por momento de registro. Comparar texto
 * AAAA-MM-DD o ISO UTC equivale a comparar el tiempo.
 * Por qué: la utilidad semanal usa el costo de la última compra, que es lo
 * que cuesta reponer hoy. Las fechas de compra no tienen hora, así que el
 * momento de registro desempata compras del mismo día.
 *
 * @throws Error si alguna fecha o momento de registro es inválido, o si las
 * dos compras más recientes empatan en fecha y en momento de registro: no
 * hay forma de saber cuál fue la última.
 */
export function ultimaCompraDe(
  compras: readonly Compra[],
  productoId: string,
): Compra | undefined {
  const delProducto = compras.filter((compra) => compra.productoId === productoId)
  delProducto.forEach((compra) => {
    validarFecha('La fecha de la compra', compra.fecha)
    validarRegistradoEn(compra.registradoEn)
  })
  if (delProducto.length === 0) return undefined

  // De más reciente a más antigua: primero por fecha, luego por registro.
  const ordenadas = [...delProducto].sort(
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
