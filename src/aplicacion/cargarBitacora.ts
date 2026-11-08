/**
 * Carga de la bitácora con los nombres de los productos.
 *
 * Qué hace: devuelve las entradas de la bitácora y un mapa id → nombre de
 * cada producto.
 * Cómo lo hace: pide las dos cosas a la vez a los repositorios que recibe.
 * Por qué: la bitácora guarda ids; la persona necesita leer "Águila". Lo usan
 * la lista y el detalle de la bitácora, así que vive en un solo lugar.
 */
import type { EntradaBitacora, RepositorioBitacora } from '../datos/bitacora'
import type { RepositorioInventario } from '../datos/inventario'

/** Lo que necesita la carga. */
export interface FuentesBitacora {
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
  inventario: Pick<RepositorioInventario, 'listarProductos'>
}

/** Entradas de la bitácora y nombre de cada producto por id. */
export interface BitacoraConNombres {
  entradas: EntradaBitacora[]
  nombres: Map<string, string>
}

export async function cargarBitacoraConNombres(fuentes: FuentesBitacora): Promise<BitacoraConNombres> {
  const [entradas, productos] = await Promise.all([
    fuentes.bitacora.listarBitacora(),
    fuentes.inventario.listarProductos(),
  ])
  return { entradas, nombres: new Map(productos.map((p) => [p.id, p.nombre])) }
}
