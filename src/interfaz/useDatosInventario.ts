/**
 * Hook que carga productos y stock.
 *
 * Qué hace: lee la lista de productos y lo que hay en bodega y nevera de cada
 * uno, y entrega el estado de la carga.
 * Cómo lo hace: llama a los dos repositorios a la vez con `useCarga`.
 * Por qué: trasladar y ajustar necesitan lo mismo; así la lectura vive en un
 * solo lugar.
 */
import { useCallback } from 'react'
import type { RepositorioInventario } from '../datos/inventario'
import { useCarga } from './useCarga'

/** Lo mínimo que se necesita del repositorio de inventario. */
export type LecturaInventario = Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock'>

export function useDatosInventario(inventario: LecturaInventario) {
  const cargar = useCallback(async () => {
    const [productos, stock] = await Promise.all([inventario.listarProductos(), inventario.obtenerStock()])
    return { productos, stock }
  }, [inventario])
  return useCarga(cargar)
}
