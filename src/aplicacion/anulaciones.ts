/**
 * Anulaciones leídas de la bitácora.
 *
 * Qué hace: devuelve, por id de registro, el motivo y el día de su anulación
 * para una tabla dada (ventas, compras, deudas o abonos).
 * Cómo lo hace: recorre las entradas `anular-registro` de esa tabla y toma
 * motivo y día local.
 * Por qué: la tabla guarda solo el estado; el motivo vive en la bitácora.
 */
import type { EntradaBitacora } from '../datos/bitacora'
import { fechaLocalIso } from '../interfaz/formato'

/** Motivo y día en que se anuló un registro. */
export interface Anulacion {
  motivo: string
  fecha: string
}

/** Mapa id del registro → su anulación; ignora entradas sin registro o motivo. */
export function anulacionesDe(entradas: readonly EntradaBitacora[], tabla: string): Map<string, Anulacion> {
  const mapa = new Map<string, Anulacion>()
  for (const e of entradas) {
    if (e.accion !== 'anular-registro' || e.tabla !== tabla || e.registroId === null || e.motivo === null) continue
    mapa.set(e.registroId, { motivo: e.motivo, fecha: fechaLocalIso(new Date(e.momento)) })
  }
  return mapa
}
