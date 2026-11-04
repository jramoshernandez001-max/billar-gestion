/**
 * Conversiones entre presentaciones de venta (unidad, sixpack, caja).
 *
 * Qué hace: traduce cualquier cantidad vendida o comprada a unidades, y
 * descompone un total de unidades en cajas completas más unidades sueltas.
 * Cómo lo hace: funciones puras, sin acceso a base de datos ni a pantalla;
 * reciben los datos del producto y devuelven un número o un objeto.
 * Por qué: el inventario se guarda siempre en unidades, así que esta es la
 * única pieza que sabe cuánto vale cada presentación. Si estuviera repartida
 * por la app, un cambio de regla se olvidaría en algún sitio y el stock
 * dejaría de cuadrar.
 */

/** Formas en que se puede vender o comprar un producto. */
import type { CategoriaProducto } from './categorias'

export type Presentacion = 'unidad' | 'sixpack' | 'caja'

/** Datos del producto que necesitan las conversiones. */
export interface ProductoConversion {
  /** Cuántas unidades trae una caja (ej.: 38 Costeñita, 30 Águila, 24 Coronita). */
  unidadesPorCaja: number
  /** Si el producto se vende por sixpack (ej.: Coronita sí, Costeñita no). */
  manejaSixpack: boolean
  /** Cerveza, licor u otro; si falta se trata como cerveza. El licor es por botella. */
  categoria?: CategoriaProducto
}

/** Un sixpack siempre son seis unidades, sin importar la cerveza. */
const UNIDADES_POR_SIXPACK = 6

/**
 * Convierte una cantidad en cierta presentación a unidades.
 *
 * Qué hace: devuelve cuántas unidades equivale `cantidad` de `presentacion`.
 * Cómo lo hace: valida la cantidad y multiplica por el factor de la presentación.
 * Por qué: el stock y los movimientos trabajan solo en unidades.
 *
 * @throws Error si la cantidad no es un entero mayor o igual a cero, o si se
 * pide sixpack de un producto que no lo maneja.
 */
export function aUnidades(
  producto: ProductoConversion,
  presentacion: Presentacion,
  cantidad: number,
): number {
  // No existen medias unidades ni cantidades negativas en un conteo físico.
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new Error('La cantidad debe ser un entero mayor o igual a cero')
  }

  switch (presentacion) {
    case 'unidad':
      return cantidad
    case 'sixpack':
      // Se rechaza para no registrar una venta que físicamente no existe.
      if (!producto.manejaSixpack) {
        throw new Error('Este producto no se maneja por sixpack')
      }
      return cantidad * UNIDADES_POR_SIXPACK
    case 'caja':
      return cantidad * producto.unidadesPorCaja
  }
}

/**
 * Descompone un total de unidades en cajas completas y unidades sueltas.
 *
 * Qué hace: devuelve cuántas cajas completas caben y cuántas unidades sobran.
 * Cómo lo hace: división entera y residuo.
 * Por qué: el negocio piensa el inventario en cajas, pero el sistema lo guarda
 * en unidades; esta función es el puente para mostrarlo.
 *
 * @throws Error si el total no es un entero mayor o igual a cero, o si las
 * unidades por caja no son un entero mayor a cero.
 */
export function descomponerEnCajas(
  totalUnidades: number,
  unidadesPorCaja: number,
): { cajas: number; sueltas: number } {
  if (!Number.isInteger(totalUnidades) || totalUnidades < 0) {
    throw new Error('El total debe ser un entero mayor o igual a cero')
  }
  // Dividir entre cero o entre un decimal daría resultados sin sentido.
  if (!Number.isInteger(unidadesPorCaja) || unidadesPorCaja <= 0) {
    throw new Error('Las unidades por caja deben ser un entero mayor a cero')
  }

  return {
    cajas: Math.floor(totalUnidades / unidadesPorCaja),
    sueltas: totalUnidades % unidadesPorCaja,
  }
}