/**
 * Lista de productos para la pantalla Productos.
 *
 * Qué hace: ordena los productos por nombre, filtra por la búsqueda y arma una
 * descripción corta de cada uno.
 * Cómo lo hace: compara nombres sin mayúsculas ni tildes.
 * Por qué: la pantalla no calcula; así la búsqueda se prueba aparte.
 */
import type { Producto } from '../datos/inventario'

export interface FilaProducto {
  id: string
  nombre: string
  /** "24 unidades por caja · Con sixpack". */
  detalle: string
  precioUnidad: number
  precioCaja: number
}

/** Minúsculas, sin tildes ni espacios sobrantes. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export function resumirProductos(productos: readonly Producto[], busqueda: string): FilaProducto[] {
  const buscado = normalizar(busqueda)
  return [...productos]
    .filter((p) => buscado === '' || normalizar(p.nombre).includes(buscado))
    .sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      detalle: `${p.unidadesPorCaja} unidades por caja · ${p.manejaSixpack ? 'Con sixpack' : 'Sin sixpack'}`,
      precioUnidad: p.precioUnidad,
      precioCaja: p.precioCaja,
    }))
}
