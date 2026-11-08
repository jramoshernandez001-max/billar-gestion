/**
 * Carga de la bitácora con los nombres de los productos.
 *
 * Qué hace: devuelve las entradas de la bitácora, un mapa id → nombre de
 * cada producto y otro con los datos que necesitan las frases.
 * Cómo lo hace: pide las dos cosas a la vez a los repositorios que recibe.
 * Por qué: la bitácora guarda ids; la persona necesita leer "Águila". Lo usan
 * la lista y el detalle de la bitácora, así que vive en un solo lugar.
 */
import type { EntradaBitacora, RepositorioBitacora } from '../datos/bitacora'
import type { RepositorioInventario } from '../datos/inventario'
import type { ProductoBitacora } from './frasesBitacora'

/** Lo que necesita la carga. */
export interface FuentesBitacora {
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
  inventario: Pick<RepositorioInventario, 'listarProductos'>
}

/** Entradas de la bitácora, nombre de cada producto y sus datos para las frases. */
export interface BitacoraConNombres {
  entradas: EntradaBitacora[]
  nombres: Map<string, string>
  /** Nombre, categoría y unidades por caja: para contar en cajas o botellas. */
  productos: Map<string, ProductoBitacora>
}

export async function cargarBitacoraConNombres(fuentes: FuentesBitacora): Promise<BitacoraConNombres> {
  const [entradas, productos] = await Promise.all([
    fuentes.bitacora.listarBitacora(),
    fuentes.inventario.listarProductos(),
  ])
  return {
    entradas,
    nombres: new Map(productos.map((p) => [p.id, p.nombre])),
    productos: new Map(productos.map((p) => [p.id, { nombre: p.nombre, categoria: p.categoria, unidadesPorCaja: p.unidadesPorCaja }])),
  }
}
