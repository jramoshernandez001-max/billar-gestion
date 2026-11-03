/**
 * Cálculo del valor de una venta.
 *
 * Qué hace: calcula el precio de lista de cada presentación (unidad, sixpack,
 * caja), el valor de cada renglón de la venta y el total.
 * Cómo lo hace: funciones puras que multiplican la cantidad por el precio que
 * corresponde; si el renglón trae un precio cobrado, usa ese en vez del de
 * lista. Todo el dinero va en pesos enteros, sin decimales.
 * Por qué: el valor de la venta es lo que se compara con el dinero en el
 * cierre. El precio cobrado permite casos como la caja a domicilio en 100.000
 * sin tocar el precio de lista, y como se guarda en la venta, un cambio de
 * precio futuro no altera el historial.
 */
import type {
  Presentacion,
  ProductoConversion,
} from '../inventario/conversiones'

/** Producto con los datos necesarios para ponerle precio. */
export interface ProductoVendible extends ProductoConversion {
  /** Precio de una unidad, en pesos. */
  precioUnidad: number
  /** Precio de una caja, en pesos. Se guarda aparte porque se puede editar. */
  precioCaja: number
}

/** Un renglón de la venta: cuánto se vendió de un producto y en qué presentación. */
export interface ItemVenta {
  producto: ProductoVendible
  presentacion: Presentacion
  cantidad: number
  /** Precio por presentación cobrado en esta venta; si falta, rige el de lista. */
  precioCobrado?: number
}

/** Un sixpack siempre son seis unidades, sin importar la cerveza. */
const UNIDADES_POR_SIXPACK = 6

/**
 * Devuelve el precio de lista de una presentación.
 *
 * Qué hace: dice cuánto vale una unidad, un sixpack o una caja del producto.
 * Cómo lo hace: la unidad y la caja usan sus precios guardados; el sixpack
 * vale seis veces el de la unidad.
 * Por qué: la caja no se calcula como unidades por precio, porque su precio es
 * editable de forma independiente.
 *
 * @throws Error si se pide sixpack de un producto que no lo maneja.
 */
export function precioDeLista(
  producto: ProductoVendible,
  presentacion: Presentacion,
): number {
  switch (presentacion) {
    case 'unidad':
      return producto.precioUnidad
    case 'sixpack':
      // Se rechaza para no cobrar una presentación que físicamente no existe.
      if (!producto.manejaSixpack) {
        throw new Error('Este producto no se maneja por sixpack')
      }
      return producto.precioUnidad * UNIDADES_POR_SIXPACK
    case 'caja':
      return producto.precioCaja
  }
}

/**
 * Calcula el valor de un renglón de la venta.
 *
 * Qué hace: devuelve cantidad por precio de la presentación vendida.
 * Cómo lo hace: valida la cantidad y el precio cobrado, y usa el precio
 * cobrado si existe o, si no, el de lista.
 * Por qué: es la unidad mínima que se suma para obtener el total de la venta.
 *
 * @throws Error si la cantidad o el precio cobrado no son enteros mayores o
 * iguales a cero.
 */
export function valorItem(item: ItemVenta): number {
  // No existen medias unidades ni cantidades negativas en una venta.
  if (!Number.isInteger(item.cantidad) || item.cantidad < 0) {
    throw new Error('La cantidad debe ser un entero mayor o igual a cero')
  }

  if (
    item.precioCobrado !== undefined &&
    (!Number.isInteger(item.precioCobrado) || item.precioCobrado < 0)
  ) {
    throw new Error('El precio cobrado debe ser un entero mayor o igual a cero')
  }

  const precio =
    item.precioCobrado ?? precioDeLista(item.producto, item.presentacion)

  return item.cantidad * precio
}

/**
 * Calcula el valor total de una venta.
 *
 * Qué hace: suma el valor de todos sus renglones.
 * Cómo lo hace: acumula el resultado de valorItem de cada renglón.
 * Por qué: este total es el que se compara con efectivo, transferencias y
 * deudas al cerrar el día.
 */
export function valorVenta(items: readonly ItemVenta[]): number {
  return items.reduce((total, item) => total + valorItem(item), 0)
}