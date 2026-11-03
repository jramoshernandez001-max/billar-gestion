/**
 * Cálculo del stock de un producto a partir de sus movimientos.
 *
 * Qué hace: dice cuántas unidades de un producto hay en bodega, en nevera y
 * en total.
 * Cómo lo hace: recorre los movimientos del producto y suma sus unidades con
 * signo en la ubicación de cada uno. Es una función pura, sin base de datos.
 * Por qué: el inventario nunca se edita a mano. Si el stock es siempre la suma
 * de lo que pasó (compras, traslados, ventas), se puede auditar y no se
 * descuadra por un número escrito mal.
 */

/** Tipos de cosas que pueden pasar con el inventario. */
export type TipoMovimiento = 'compra' | 'traslado' | 'venta' | 'ajuste'

/** Lugares donde se guarda el producto. */
export type Ubicacion = 'bodega' | 'nevera'

/**
 * Un cambio en el inventario de un producto, en una ubicación.
 * `unidades` lleva signo: positivo si entra a esa ubicación, negativo si sale.
 * Un traslado se registra como dos movimientos: uno resta en bodega y otro
 * suma en nevera.
 */
export interface Movimiento {
  productoId: string
  tipo: TipoMovimiento
  ubicacion: Ubicacion
  unidades: number
}

/** Stock de un producto, siempre en unidades. */
export interface Stock {
  bodega: number
  nevera: number
  total: number
}

/**
 * Calcula el stock de un producto sumando sus movimientos.
 *
 * Qué hace: devuelve las unidades en bodega, en nevera y el total.
 * Cómo lo hace: ignora los movimientos de otros productos y acumula las
 * unidades de los demás según su ubicación.
 * Por qué: es la única fuente de verdad del inventario.
 *
 * @throws Error si algún movimiento del producto tiene unidades que no son
 * un entero, porque no existen medias unidades en un conteo físico.
 */
export function calcularStock(
  movimientos: readonly Movimiento[],
  productoId: string,
): Stock {
  let bodega = 0
  let nevera = 0

  for (const movimiento of movimientos) {
    if (movimiento.productoId !== productoId) continue

    if (!Number.isInteger(movimiento.unidades)) {
      throw new Error('Las unidades de un movimiento deben ser un entero')
    }

    if (movimiento.ubicacion === 'bodega') {
      bodega += movimiento.unidades
    } else {
      nevera += movimiento.unidades
    }
  }

  return { bodega, nevera, total: bodega + nevera }
}