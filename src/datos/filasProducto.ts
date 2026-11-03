/**
 * Lectura de filas de productos para los cálculos del dominio.
 *
 * Qué hace: convierte una fila de `productos` en los datos que necesitan las
 * ventas y las compras (conversión a unidades y precios de lista).
 * Cómo lo hace: revisa el tipo de cada columna y renombra a camelCase.
 * Por qué: ventas y compras leen productos igual; así la conversión y su
 * validación viven en un solo lugar.
 */
import type { ProductoVendible } from '../domain/ventas/valorVenta'
import { esEntero, esObjeto } from './entradas'

/** Columnas de `productos` que se piden al leer. */
export const COLUMNAS_PRODUCTO = 'id, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja'

/** Convierte una fila de productos a su id y sus datos de venta/conversión. */
export function filaAProductoVendible(fila: unknown): { id: string; producto: ProductoVendible } {
  if (
    !esObjeto(fila) ||
    typeof fila.id !== 'string' ||
    !esEntero(fila.unidades_por_caja) ||
    typeof fila.maneja_sixpack !== 'boolean' ||
    !esEntero(fila.precio_unidad) ||
    !esEntero(fila.precio_caja)
  ) {
    throw new Error('Una fila de productos no tiene la forma esperada')
  }
  return {
    id: fila.id,
    producto: {
      unidadesPorCaja: fila.unidades_por_caja,
      manejaSixpack: fila.maneja_sixpack,
      precioUnidad: fila.precio_unidad,
      precioCaja: fila.precio_caja,
    },
  }
}
