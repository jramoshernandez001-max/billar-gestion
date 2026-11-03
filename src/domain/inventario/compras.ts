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
 * Qué hace: devuelve la compra del producto con la fecha más reciente, o
 * undefined si el producto no tiene compras.
 * Cómo lo hace: filtra por producto, valida las fechas y se queda con la
 * mayor; comparar texto AAAA-MM-DD equivale a comparar fechas.
 * Por qué: la utilidad semanal usa el costo de la última compra, que es lo
 * que cuesta reponer hoy.
 *
 * @throws Error si alguna fecha es inválida, o si hay dos o más compras del
 * producto en la fecha más reciente: las fechas no tienen hora y todavía no
 * está definido cuál manda en ese caso (ver docs/PENDIENTES.md).
 */
export function ultimaCompraDe(
  compras: readonly Compra[],
  productoId: string,
): Compra | undefined {
  const delProducto = compras.filter((compra) => compra.productoId === productoId)
  delProducto.forEach((compra) => validarFecha('La fecha de la compra', compra.fecha))
  if (delProducto.length === 0) return undefined

  const fechaMasReciente = delProducto.reduce(
    (mayor, compra) => (compra.fecha > mayor ? compra.fecha : mayor),
    delProducto[0].fecha,
  )
  const enEsaFecha = delProducto.filter((compra) => compra.fecha === fechaMasReciente)
  if (enEsaFecha.length > 1) {
    throw new Error(
      'Hay varias compras del producto en la misma fecha más reciente; no está definido cuál usar',
    )
  }
  return enEsaFecha[0]
}
