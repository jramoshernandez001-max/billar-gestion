/**
 * Registro de anulación.
 *
 * Qué hace: construye la entrada de la bitácora que anula un registro ya
 * hecho (una compra, un traslado, una venta, una deuda…), con el motivo y
 * el valor de antes y de después.
 * Cómo lo hace: función pura que valida el motivo y el valor de antes, y
 * reutiliza crearRegistroBitacora con la acción 'anular-registro'.
 * Por qué: nada se borra; un error se corrige con un registro de corrección
 * que queda en la bitácora. Cualquiera de los dos usuarios puede anular, así
 * que no se revisa quién es, pero el motivo es obligatorio para que después
 * se entienda por qué se anuló.
 */
import { crearRegistroBitacora, type RegistroBitacora } from './bitacora'

/** Datos para anular un registro. */
export interface DatosAnulacion<T> {
  /** Quién anula (cualquiera de los usuarios autorizados). */
  usuario: string
  /** Cuándo se anula. */
  momento: Date
  /** Por qué se anula; obligatorio. */
  motivo: string
  /** El registro como estaba antes de anularlo. */
  antes: T
  /** El registro como queda después (por ejemplo, marcado como anulado). */
  despues: T
}

/** Entrada de la bitácora de una anulación: un registro con su motivo. */
export interface RegistroAnulacion<T> extends RegistroBitacora<T> {
  motivo: string
}

/**
 * Construye el registro de anulación.
 *
 * Qué hace: devuelve el registro de bitácora con la acción de anular y el
 * motivo.
 * Cómo lo hace: limpia y valida el motivo, exige el valor de antes y arma
 * el resto con crearRegistroBitacora.
 * Por qué: solo se puede anular algo que ya existe, por eso el valor de
 * antes no puede faltar.
 *
 * @throws Error si el motivo está vacío, si falta el valor de antes, o si
 * falla alguna validación de la bitácora (usuario, fecha y hora, después).
 */
export function crearRegistroAnulacion<T>(datos: DatosAnulacion<T>): RegistroAnulacion<T> {
  const motivo = datos.motivo.trim()
  if (motivo.length === 0) {
    throw new Error('El motivo de la anulación es obligatorio')
  }
  if (datos.antes === null || datos.antes === undefined) {
    throw new Error('Para anular hace falta el valor de antes: solo se anula algo que ya existe')
  }

  const registro = crearRegistroBitacora({
    usuario: datos.usuario,
    momento: datos.momento,
    accion: 'anular-registro',
    antes: datos.antes,
    despues: datos.despues,
  })
  return { ...registro, motivo }
}
