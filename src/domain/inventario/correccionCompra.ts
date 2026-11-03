/**
 * Corrección del costo de una compra.
 *
 * Qué hace: corrige el costo de una compra ya registrada y arma su registro
 * de bitácora; y aplica la compra corregida a una lista de compras.
 * Cómo lo hace: funciones puras. La corrección devuelve una copia de la
 * compra con el costo nuevo (la original no se toca) y un registro con la
 * compra de antes y la de después, hecho con crearRegistroBitacora.
 * Por qué: el costo se captura a mano y puede quedar mal. Nada se borra: el
 * valor de antes queda en la bitácora. La compra conserva su id, su fecha y
 * su momento de registro, así que sigue en el mismo lugar del orden de
 * compras; si era la última de su producto, la utilidad usa el costo nuevo.
 */
import { crearRegistroBitacora, type RegistroBitacora } from '../compartido/bitacora'
import { validarMonto } from '../compartido/validaciones'
import type { Compra } from './compras'

/** Datos para corregir el costo de una compra. */
export interface DatosCorreccionCosto {
  compra: Compra
  /** Costo total correcto de la compra, en pesos. */
  costoNuevo: number
  /** Quién corrige. */
  usuario: string
  /** Cuándo se corrige. */
  momento: Date
}

/** Resultado de corregir el costo. */
export interface CorreccionCosto {
  /** La compra con el costo nuevo. */
  compra: Compra
  /** Registro de bitácora con la compra antes y después. */
  registro: RegistroBitacora<Compra>
}

/**
 * Corrige el costo de una compra.
 *
 * Qué hace: devuelve la compra corregida y su registro de bitácora.
 * Cómo lo hace: valida el costo nuevo, copia la compra cambiando solo el
 * costo y arma el registro con la acción corregir-costo-compra.
 * Por qué: solo cambia el costo; cantidad, fecha y producto siguen iguales,
 * así que el inventario no se mueve.
 *
 * @throws Error si el costo nuevo no es un entero mayor o igual a cero o si
 * falla alguna validación de la bitácora.
 */
export function corregirCostoCompra(datos: DatosCorreccionCosto): CorreccionCosto {
  validarMonto('El costo nuevo de la compra', datos.costoNuevo)
  const corregida: Compra = { ...datos.compra, costoTotal: datos.costoNuevo }
  return {
    compra: corregida,
    registro: crearRegistroBitacora({
      usuario: datos.usuario,
      momento: datos.momento,
      accion: 'corregir-costo-compra',
      antes: datos.compra,
      despues: corregida,
    }),
  }
}

/**
 * Aplica una compra corregida a la lista de compras vigentes.
 *
 * Qué hace: devuelve una lista nueva donde la compra con el mismo id quedó
 * reemplazada por la corregida.
 * Cómo lo hace: recorre la lista y cambia solo la que coincide en id.
 * Por qué: la lista vigente es la que usan ultimaCompraDe y el cierre; si
 * quedaran la vieja y la corregida, serían dos compras empatadas. La versión
 * vieja no se pierde: queda en la bitácora.
 *
 * @throws Error si ninguna compra de la lista tiene ese id.
 */
export function aplicarCorreccionCompra(
  compras: readonly Compra[],
  corregida: Compra,
): Compra[] {
  if (!compras.some((compra) => compra.id === corregida.id)) {
    throw new Error(`La compra ${corregida.id} no está en la lista de compras`)
  }
  return compras.map((compra) => (compra.id === corregida.id ? corregida : compra))
}
