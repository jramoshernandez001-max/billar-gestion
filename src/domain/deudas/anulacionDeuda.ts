/**
 * Anulación de deudas y abonos.
 *
 * Qué hace: anula una deuda o un abono vigente: devuelve el registro con
 * estado anulada y el registro de anulación para la bitácora.
 * Cómo lo hace: funciones puras que copian el registro cambiando solo el
 * estado y reutilizan crearRegistroAnulacion (motivo obligatorio).
 * Por qué: nada se borra. Una deuda anulada deja de deber y un abono anulado
 * deja de restar, pero los dos quedan guardados con su historia. Una deuda
 * con abonos vigentes no se puede anular: esos pagos quedarían colgando de
 * una deuda que ya no cuenta, así que primero se anulan los abonos.
 */
import { crearRegistroAnulacion, type RegistroAnulacion } from '../compartido/anulacion'
import { estaVigente } from '../compartido/estado'
import type { Abono, Deuda } from './deudas'

/** Datos para anular una deuda. */
export interface DatosAnulacionDeuda {
  deuda: Deuda
  /** Abonos registrados; se revisan los de esta deuda. */
  abonos: readonly Abono[]
  motivo: string
  usuario: string
  momento: Date
}

/** Datos para anular un abono. */
export interface DatosAnulacionAbono {
  abono: Abono
  motivo: string
  usuario: string
  momento: Date
}

/**
 * Anula una deuda vigente sin abonos vigentes.
 *
 * Qué hace: devuelve la deuda anulada y su registro.
 * Cómo lo hace: rechaza una deuda ya anulada o con abonos vigentes, copia la
 * deuda con estado anulada y arma el registro con el motivo.
 * Por qué: ver el comentario del archivo.
 *
 * @throws Error si la deuda ya está anulada, si tiene abonos vigentes, si el
 * motivo está vacío o si falla alguna validación de la bitácora.
 */
export function anularDeuda(datos: DatosAnulacionDeuda): {
  deuda: Deuda
  registro: RegistroAnulacion<Deuda>
} {
  if (!estaVigente(datos.deuda, `La deuda ${datos.deuda.id}`)) {
    throw new Error(`La deuda ${datos.deuda.id} ya está anulada`)
  }
  const conAbonosVigentes = datos.abonos.some(
    (abono) => abono.deudaId === datos.deuda.id && estaVigente(abono, `El abono ${abono.id}`),
  )
  if (conAbonosVigentes) {
    throw new Error(
      `La deuda ${datos.deuda.id} tiene abonos vigentes: anule primero los abonos y luego la deuda`,
    )
  }

  const anulada: Deuda = { ...datos.deuda, estado: 'anulada' }
  return {
    deuda: anulada,
    registro: crearRegistroAnulacion({
      usuario: datos.usuario,
      momento: datos.momento,
      motivo: datos.motivo,
      antes: datos.deuda,
      despues: anulada,
    }),
  }
}

/**
 * Anula un abono vigente.
 *
 * Qué hace: devuelve el abono anulado y su registro.
 * Cómo lo hace: rechaza un abono ya anulado, lo copia con estado anulada y
 * arma el registro con el motivo.
 * Por qué: un abono mal registrado no se borra; al anularlo, la deuda vuelve
 * a deber ese monto.
 *
 * @throws Error si el abono ya está anulado, si el motivo está vacío o si
 * falla alguna validación de la bitácora.
 */
export function anularAbono(datos: DatosAnulacionAbono): {
  abono: Abono
  registro: RegistroAnulacion<Abono>
} {
  if (!estaVigente(datos.abono, `El abono ${datos.abono.id}`)) {
    throw new Error(`El abono ${datos.abono.id} ya está anulado`)
  }
  const anulado: Abono = { ...datos.abono, estado: 'anulada' }
  return {
    abono: anulado,
    registro: crearRegistroAnulacion({
      usuario: datos.usuario,
      momento: datos.momento,
      motivo: datos.motivo,
      antes: datos.abono,
      despues: anulado,
    }),
  }
}
