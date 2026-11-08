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
import type { CategoriaProducto } from '../domain/inventario/categorias'

/** Datos del producto que necesita el resumen. */
export interface ProductoResumen {
  id: string
  nombre: string
  categoria: CategoriaProducto
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
  categoria: CategoriaProducto
  /** Unidades que trae una caja de este producto (para totalizar cajas). */
  unidadesPorCaja: number
  bodega: number
  nevera: number
  total: number
  /** Total en cajas, sixpacks y sueltas; null si hay stock negativo o es licor (botellas). */
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
        categoria: producto.categoria,
        unidadesPorCaja: producto.unidadesPorCaja,
        bodega: s.bodega,
        nevera: s.nevera,
        total: s.total,
        equivalente: negativo || producto.categoria === 'licor' ? null : aEquivalente(s.total, producto),
        negativo,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

/** Cajas completas y unidades sueltas de una ubicación o del total. */
export interface CajasYSueltas {
  cajas: number
  sueltas: number
}

/** Totales de cajas que la pantalla de inventario muestra arriba. */
export interface TotalesCajas {
  bodega: CajasYSueltas
  nevera: CajasYSueltas
  general: CajasYSueltas
}

/**
 * Parte unidades de un producto en cajas completas y sueltas.
 *
 * Qué hace: devuelve cuántas cajas completas caben y cuántas unidades sobran.
 * Cómo lo hace: Math.trunc (no floor) para que un negativo dé 0 cajas y las
 * unidades negativas queden como sueltas.
 * Por qué: un stock negativo es un registro faltante; no debe restar cajas
 * enteras que nunca existieron, sino verse tal cual.
 */
function partirEnCajas(unidades: number, unidadesPorCaja: number): CajasYSueltas {
  const cajas = Math.trunc(unidades / unidadesPorCaja)
  return { cajas, sueltas: unidades - cajas * unidadesPorCaja }
}

/** Suma dos conteos de cajas y sueltas. */
function sumar(a: CajasYSueltas, b: CajasYSueltas): CajasYSueltas {
  return { cajas: a.cajas + b.cajas, sueltas: a.sueltas + b.sueltas }
}

/**
 * Totaliza las cajas de bodega, nevera y en general.
 *
 * Qué hace: suma, para las filas dadas, las cajas completas y las unidades
 * sueltas de cada ubicación y del total.
 * Cómo lo hace: parte cada producto por separado con sus propias unidades por
 * caja (una caja de Costeñita no trae lo mismo que una de Coronita) y suma
 * los resultados. El total general se parte desde el total del producto, así
 * que sueltas de bodega y nevera que juntas forman una caja cuentan como caja.
 * Deja fuera el licor, que se maneja por botella y no tiene caja.
 * Por qué: el negocio cuenta la cerveza por cajas; ver arriba "tengo 12 cajas
 * en bodega y 3 en nevera" ahorra sumar tarjeta por tarjeta.
 */
export function totalizarCajas(filas: readonly FilaInventario[]): TotalesCajas {
  const cero: CajasYSueltas = { cajas: 0, sueltas: 0 }
  return filas
    .filter((f) => f.categoria !== 'licor')
    .reduce<TotalesCajas>(
      (acumulado, f) => ({
        bodega: sumar(acumulado.bodega, partirEnCajas(f.bodega, f.unidadesPorCaja)),
        nevera: sumar(acumulado.nevera, partirEnCajas(f.nevera, f.unidadesPorCaja)),
        general: sumar(acumulado.general, partirEnCajas(f.total, f.unidadesPorCaja)),
      }),
      { bodega: cero, nevera: cero, general: cero },
    )
}

/** Lo que queda de un producto que se cuenta por cajas (cerveza, otros). */
export interface DetalleEnCajas {
  productoId: string
  nombre: string
  tipo: 'cajas'
  cajas: number
  sueltas: number
}

/** Lo que queda de un licor, que se cuenta por botellas. */
export interface DetalleEnBotellas {
  productoId: string
  nombre: string
  tipo: 'botellas'
  botellas: number
}

export type DetalleExistencia = DetalleEnCajas | DetalleEnBotellas

/**
 * Detalle de lo que queda de cada producto.
 *
 * Qué hace: por cada fila devuelve cuántas cajas completas y cuántos envases
 * sueltos quedan en total (bodega + nevera); para el licor, cuántas botellas.
 * Cómo lo hace: parte el total de cada producto con sus propias unidades por
 * caja (igual que totalizarCajas); el licor va directo en botellas.
 * Por qué: el total general de cajas mezcla productos; el detalle responde
 * "¿cuántas cajas de Águila me quedan?" sin sumar a mano.
 */
export function detallarExistencias(filas: readonly FilaInventario[]): DetalleExistencia[] {
  return filas.map((f) =>
    f.categoria === 'licor'
      ? { productoId: f.productoId, nombre: f.nombre, tipo: 'botellas', botellas: f.total }
      : { productoId: f.productoId, nombre: f.nombre, tipo: 'cajas', ...partirEnCajas(f.total, f.unidadesPorCaja) },
  )
}
