/**
 * Productos adicionales de una venta (el apartado "Otros").
 *
 * Qué hace: define un producto adicional (nombre, cantidad y valor total),
 * lo limpia y valida, suma su valor y junta los de las ventas vigentes.
 * Cómo lo hace: funciones puras; el nombre se limpia y valida con la misma
 * regla de las descripciones de deudas (validarDescripcion), y el valor es el
 * total del renglón (5 hidratantes por 25.000 → valor 25.000), no el precio
 * por unidad.
 * Por qué: hay productos que no se manejan en inventario, pero cuya plata
 * sí está en la caja al final del día. Si no se registran, el cierre sale
 * con un sobrante que no se puede explicar. No mueven inventario ni tienen
 * costo, así que en el cierre semanal van aparte, sin utilidad.
 */
import { estaVigente } from '../compartido/estado'
import { validarDescripcion } from '../deudas/descripcion'
import type { Venta } from './venta'

/** Un producto vendido que no está en el inventario. */
export interface ProductoAdicional {
  /** Nombre del producto, ya limpio (ej.: "Hidratante"). */
  descripcion: string
  /** Cuántos se vendieron. */
  cantidad: number
  /** Valor total cobrado por todos, en pesos. */
  valor: number
}

const NOMBRE = 'El nombre del producto adicional'

/**
 * Valida un producto adicional.
 *
 * Qué hace: lanza un error si el nombre está vacío o sucio, o si la
 * cantidad o el valor no son enteros mayores a cero.
 * Cómo lo hace: usa validarDescripcion para el nombre y revisa los números.
 * Por qué: un renglón sin nombre no se entiende después, y uno sin cantidad
 * o sin valor no vende nada; la base aplica las mismas reglas.
 *
 * @throws Error con el campo que falló.
 */
export function validarAdicional(adicional: ProductoAdicional): void {
  validarDescripcion(NOMBRE, adicional.descripcion)
  if (!Number.isInteger(adicional.cantidad) || adicional.cantidad <= 0) {
    throw new Error('La cantidad del producto adicional debe ser un entero mayor a cero')
  }
  if (!Number.isInteger(adicional.valor) || adicional.valor <= 0) {
    throw new Error('El valor del producto adicional debe ser un entero mayor a cero')
  }
}

/**
 * Limpia y valida un producto adicional al capturarlo.
 *
 * Qué hace: devuelve el producto con el nombre limpio.
 * Cómo lo hace: normaliza el nombre (lados y espacios repetidos) y valida.
 * Por qué: un espacio de más no debe impedir registrar la venta.
 *
 * @throws Error si algún campo no es válido.
 */
export function normalizarAdicional(adicional: ProductoAdicional): ProductoAdicional {
  // Misma limpieza de normalizarDescripcion, pero con el mensaje de este campo.
  const limpio = { ...adicional, descripcion: adicional.descripcion.trim().replace(/\s+/g, ' ') }
  validarAdicional(limpio)
  return limpio
}

/**
 * Suma el valor de los productos adicionales.
 *
 * Qué hace: devuelve la suma de sus valores.
 * Cómo lo hace: acumula el valor de cada uno (ya es el total del renglón).
 * Por qué: ese dinero se suma a lo vendido para cuadrar el cierre.
 */
export function valorAdicionales(adicionales: readonly ProductoAdicional[]): number {
  return adicionales.reduce((total, adicional) => total + adicional.valor, 0)
}

/**
 * Junta los productos adicionales de las ventas vigentes.
 *
 * Qué hace: devuelve los adicionales de las ventas en estado vigente.
 * Cómo lo hace: descarta las anuladas y aplana sus adicionales (una venta
 * sin adicionales no aporta nada).
 * Por qué: una venta anulada no suma en los cierres, tampoco su "Otros".
 *
 * @throws Error si alguna venta tiene un estado desconocido.
 */
export function adicionalesVigentes(ventas: readonly Venta[]): ProductoAdicional[] {
  return ventas.flatMap((venta) =>
    estaVigente(venta, `La venta ${venta.id}`) ? [...(venta.adicionales ?? [])] : [],
  )
}
