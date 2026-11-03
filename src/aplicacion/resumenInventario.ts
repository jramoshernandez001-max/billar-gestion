/**
 * Resumen de inventario para la pantalla de stock.
 *
 * Qué hace: arma una fila por producto con bodega, nevera, total, el total
 * expresado en cajas, sixpacks y sueltas, y un aviso si hay stock negativo.
 * Cómo lo hace: combina el catálogo con el stock calculado por ubicación;
 * divide el total entre las unidades por caja y, si el producto maneja
 * sixpack, el resto entre 6.
 * Por qué: el stock se guarda en unidades, pero se entiende mejor como "2
 * cajas y 5 sueltas". Un negativo no se oculta: señala un registro faltante
 * (una compra o un traslado sin cargar) que hay que corregir.
 */
import type { Stock } from '../domain/inventario/stock'

/** Datos del producto que necesita el resumen. */
export interface ProductoResumen {
  id: string
  nombre: string
  unidadesPorCaja: number
  manejaSixpack: boolean
}

/** El total expresado en presentaciones. */
export interface Equivalente {
  cajas: number
  sixpacks: number
  sueltas: number
}

/** Una fila de la tabla de inventario. */
export interface FilaInventario {
  productoId: string
  nombre: string
  bodega: number
  nevera: number
  total: number
  /** Total en cajas, sixpacks y sueltas; null si hay stock negativo. */
  equivalente: Equivalente | null
  /** Verdadero si alguna ubicación quedó por debajo de cero. */
  negativo: boolean
}

const UNIDADES_POR_SIXPACK = 6
const SIN_STOCK: Stock = { bodega: 0, nevera: 0, total: 0 }

/** Expresa una cantidad de unidades en cajas, sixpacks y sueltas. */
function aEquivalente(total: number, producto: ProductoResumen): Equivalente {
  const cajas = Math.floor(total / producto.unidadesPorCaja)
  const resto = total - cajas * producto.unidadesPorCaja
  if (!producto.manejaSixpack) return { cajas, sixpacks: 0, sueltas: resto }
  const sixpacks = Math.floor(resto / UNIDADES_POR_SIXPACK)
  return { cajas, sixpacks, sueltas: resto - sixpacks * UNIDADES_POR_SIXPACK }
}

/** Arma la tabla de inventario, ordenada por nombre. */
export function resumirInventario(
  productos: readonly ProductoResumen[],
  stock: ReadonlyMap<string, Stock>,
): FilaInventario[] {
  return productos
    .map((producto): FilaInventario => {
      const s = stock.get(producto.id) ?? SIN_STOCK
      const negativo = s.bodega < 0 || s.nevera < 0
      return {
        productoId: producto.id,
        nombre: producto.nombre,
        bodega: s.bodega,
        nevera: s.nevera,
        total: s.total,
        equivalente: negativo ? null : aEquivalente(s.total, producto),
        negativo,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}
