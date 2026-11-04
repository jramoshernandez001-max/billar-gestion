/**
 * Categorías de producto (cerveza, licor, otros).
 *
 * Qué hace: define las categorías, sus nombres, qué presentaciones de venta
 * y compra admite cada una y cómo se filtra una lista por categoría.
 * Cómo lo hace: funciones puras sobre una tabla fija.
 * Por qué: el local no vende solo cerveza. Las botellas de licor se venden
 * enteras (sin sixpack ni caja); la cerveza y los demás productos usan unidad,
 * sixpack (si el producto lo maneja) y caja. Centralizarlo evita repetir la
 * regla en cada pantalla.
 */
import type { Presentacion } from './conversiones'

export type CategoriaProducto = 'cerveza' | 'licor' | 'otro'

/** Todas las categorías, en el orden en que se muestran. */
export const CATEGORIAS: readonly CategoriaProducto[] = ['cerveza', 'licor', 'otro']

/** Categoría elegida en un filtro: una o todas. */
export type FiltroCategoria = CategoriaProducto | 'todas'

const ETIQUETAS: Record<CategoriaProducto, string> = { cerveza: 'Cerveza', licor: 'Licor', otro: 'Otros' }

/** Nombre para mostrar de una categoría. */
export function etiquetaCategoria(categoria: CategoriaProducto): string {
  return ETIQUETAS[categoria]
}

/** Dice si un valor es una categoría válida. */
export function esCategoria(valor: unknown): valor is CategoriaProducto {
  return typeof valor === 'string' && (CATEGORIAS as readonly string[]).includes(valor)
}

/**
 * Dice si una presentación se puede usar con un producto.
 *
 * Qué hace: el licor solo admite unidad (botella); las demás categorías
 * admiten unidad y caja, y sixpack solo si el producto lo maneja.
 */
export function presentacionPermitida(
  categoria: CategoriaProducto,
  presentacion: Presentacion,
  manejaSixpack: boolean,
): boolean {
  if (categoria === 'licor') return presentacion === 'unidad'
  if (presentacion === 'sixpack') return manejaSixpack
  return true
}

/** Opción de presentación para el selector de la pantalla. */
export interface OpcionPresentacion {
  valor: Presentacion
  etiqueta: string
  noDisponible?: boolean
}

/**
 * Opciones de presentación que se ofrecen para un producto.
 *
 * Qué hace: el licor ofrece solo "Botella"; los demás ofrecen Unidad,
 * Sixpack (tachado si no lo maneja) y Caja.
 */
export function opcionesDePresentacion(categoria: CategoriaProducto, manejaSixpack: boolean): OpcionPresentacion[] {
  if (categoria === 'licor') return [{ valor: 'unidad', etiqueta: 'Botella' }]
  return [
    { valor: 'unidad', etiqueta: 'Unidad' },
    { valor: 'sixpack', etiqueta: 'Sixpack', noDisponible: !manejaSixpack },
    { valor: 'caja', etiqueta: 'Caja' },
  ]
}

/** Deja solo los elementos de la categoría pedida ("todas" deja todo). */
export function filtrarPorCategoria<T extends { categoria: CategoriaProducto }>(
  elementos: readonly T[],
  filtro: FiltroCategoria,
): T[] {
  return filtro === 'todas' ? [...elementos] : elementos.filter((e) => e.categoria === filtro)
}
