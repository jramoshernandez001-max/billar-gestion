/**
 * Corrección del dinero contado de un cierre.
 *
 * Qué hace: corrige el efectivo y las transferencias de un cierre guardado y
 * arma su registro de bitácora con antes y después.
 * Cómo lo hace: función pura que copia el cierre con el dinero nuevo y con
 * dineroCorregidoEn igual al momento de la corrección; el resultado y el
 * momento del cálculo no cambian.
 * Por qué: el dinero se cuenta a mano y puede quedar mal. Corregirlo cambia
 * el cuadre, pero el cierre no se recalcula solo: queda desactualizado
 * (estaDesactualizado lo detecta) hasta que un usuario lo recalcule a mano.
 */
import { crearRegistroBitacora, type RegistroBitacora } from '../compartido/bitacora'
import { validarMonto } from '../compartido/validaciones'
import type { CierreGuardado } from './actualizacionCierre'

/** Datos para corregir el dinero contado. */
export interface DatosCorreccionDinero<R> {
  cierre: CierreGuardado<R>
  /** Efectivo correcto, en pesos. */
  efectivo: number
  /** Transferencias correctas, en pesos. */
  transferencias: number
  usuario: string
  momento: Date
}

/** Cierre corregido y su registro de bitácora. */
export interface CorreccionDinero<R> {
  cierre: CierreGuardado<R>
  registro: RegistroBitacora<CierreGuardado<R>>
}

/**
 * Corrige el dinero contado de un cierre.
 *
 * Qué hace: devuelve el cierre con el dinero nuevo y su registro.
 * Cómo lo hace: valida los montos y el momento, copia el cierre con el
 * dinero nuevo y la marca de corrección, y arma el registro con la acción
 * corregir-dinero-cierre.
 * Por qué: ver el comentario del archivo.
 *
 * @throws Error si algún monto no es un entero mayor o igual a cero, si el
 * momento es inválido o si falla alguna validación de la bitácora.
 */
export function corregirDineroCierre<R>(datos: DatosCorreccionDinero<R>): CorreccionDinero<R> {
  validarMonto('El efectivo', datos.efectivo)
  validarMonto('Las transferencias', datos.transferencias)
  if (Number.isNaN(datos.momento.getTime())) {
    throw new Error('El momento de la corrección no es una fecha y hora válida')
  }

  const corregido: CierreGuardado<R> = {
    ...datos.cierre,
    efectivo: datos.efectivo,
    transferencias: datos.transferencias,
    dineroCorregidoEn: datos.momento.toISOString(),
  }
  return {
    cierre: corregido,
    registro: crearRegistroBitacora({
      usuario: datos.usuario,
      momento: datos.momento,
      accion: 'corregir-dinero-cierre',
      antes: datos.cierre,
      despues: corregido,
    }),
  }
}
