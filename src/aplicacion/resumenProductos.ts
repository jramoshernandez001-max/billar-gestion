/**
 * Lista de productos para la pantalla Productos.
 *
 * Qué hace: ordena los productos por nombre, filtra por la búsqueda y arma una
 * descripción corta de cada uno.
 * Cómo lo hace: compara nombres sin mayúsculas ni tildes.
 * Por qué: la pantalla no calcula; así la búsqueda se prueba aparte.
 */
import type { Producto } from '../datos/inventario'
import { filtrarPorCategoria, type CategoriaProducto, type FiltroCategoria } from '../domain/inventario/categorias'

export interface FilaProducto {
  id: string
  nombre: string
  categoria: CategoriaProducto
  /** "24 unidades por caja · Con sixpack", o "Botella entera" si es licor. */
  detalle: string
  precioUnidad: number
  precioCaja: number
}

/** Minúsculas, sin tildes ni espacios sobrantes. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export function resumirProductos(
  productos: readonly Producto[],
  busqueda: string,
  categoria: FiltroCategoria = 'todas',
): FilaProducto[] {
  const buscado = normalizar(busqueda)
  return filtrarPorCategoria(productos, categoria)
    .filter((p) => buscado === '' || normalizar(p.nombre).includes(buscado))
    .sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      detalle:
        p.categoria === 'licor'
          ? 'Botella entera'
          : `${p.unidadesPorCaja} unidades por caja · ${p.manejaSixpack ? 'Con sixpack' : 'Sin sixpack'}`,
      precioUnidad: p.precioUnidad,
      precioCaja: p.precioCaja,
    }))
}
